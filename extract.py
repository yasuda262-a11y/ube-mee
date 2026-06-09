#!/usr/bin/env python3
"""
UBE Smart Sheets PDF → questions.json extractor
Fix: is_marker now preserves list labels like a), b), c), 1), 2), i)
"""
import fitz
import json
import re
import sys
from pathlib import Path

# ---- PDF paths ----
PDF_ORIG   = Path("/Users/yasudayukihiro/Documents/02_UBE Smart Sheets July 2026 PreOrder.pdf")
PDF_MARKED = Path("/Users/yasudayukihiro/Documents/02_UBE Smart Sheets July 2026 PreOrder_Marked.pdf")
OUT_JSON   = Path("/Users/yasudayukihiro/Desktop/ube-app/app/data/questions.json")

# ---- subject mapping by page range (1-indexed human page numbers) ----
# Pages 1-5 are intro/title pages — skip them
SUBJECT_RANGES = [
    (6,   8,   "AGENCY"),
    (9,   13,  "PARTNERSHIPS"),
    (14,  22,  "CORPORATIONS & LLC'S"),
    (23,  31,  "CIVIL PROCEDURE"),
    (32,  38,  "CONSTITUTIONAL LAW"),
    (39,  48,  "CONTRACTS"),
    (49,  56,  "CRIMINAL LAW & PROCEDURE"),
    (57,  63,  "EVIDENCE"),
    (64,  72,  "REAL PROPERTY"),
    (73,  80,  "TORTS"),
]
SUBJECT_MAP = {}
for (s, e, subj) in SUBJECT_RANGES:
    for p in range(s, e + 1):
        SUBJECT_MAP[p] = subj

def get_subject(page_num):
    return SUBJECT_MAP.get(page_num, "UNKNOWN")

# ---- color helpers ----
def is_green(r, g, b):
    return g > 0.3 and g > r * 1.2 and g > b * 1.2

def is_black(r, g, b):
    return r < 0.25 and g < 0.25 and b < 0.25

def color_to_rgb(c):
    if isinstance(c, int):
        r = ((c >> 16) & 0xFF) / 255
        g = ((c >>  8) & 0xFF) / 255
        b = ( c        & 0xFF) / 255
        return r, g, b
    if isinstance(c, (list, tuple)) and len(c) == 3:
        return c[0], c[1], c[2]
    return 0, 0, 0

# ---- is_marker: excludes small H/M/L priority blocks but NOT list labels ----
def is_marker(b):
    """True if block should be ignored (small priority badge, not a list label)."""
    text = b[4].strip()
    # Preserve list labels like a), b), c), 1), 2), i), ii), iii)
    if re.match(r'^(\d+[).]|[a-z][).]|[ivxlcdm]+[).])$', text, re.IGNORECASE):
        return False
    return (b[2] - b[0]) < 25 and (b[3] - b[1]) < 20

# ---- extract green masks from a page ----
def get_green_masks(page):
    masks = []
    for path in page.get_drawings():
        c = path.get("fill") or path.get("color")
        if c is None:
            continue
        r, g, b = color_to_rgb(c)
        if not is_green(r, g, b):
            continue
        rect = path["rect"]
        if rect.width < 5 or rect.height < 3:
            continue
        masks.append(rect)
    return masks

# ---- extract black section header rects ----
def get_section_headers(page):
    headers = []
    for path in page.get_drawings():
        c = path.get("fill")
        if c is None:
            continue
        r, g, b = color_to_rgb(c)
        if not is_black(r, g, b):
            continue
        rect = path["rect"]
        # Real section header bars: height ≈ 13.4–15.2 pt (clear gap above shadow rects ≤12.4)
        if rect.width > 150 and rect.height > 12.5:
            headers.append(rect)
    return headers

# ---- extract priority circles (H/M/L) ----
def get_priority_circles(page):
    """Returns list of (rect, priority_char) for H/M/L markers."""
    circles = []
    for path in page.get_drawings():
        c = path.get("fill") or path.get("color")
        if c is None:
            continue
        r, g, b = color_to_rgb(c)
        rect = path["rect"]
        w, h = rect.width, rect.height
        if not (8 <= w <= 25 and 8 <= h <= 25):
            continue
        # Red=H, Orange=M, Yellow=L
        if r > 0.6 and g < 0.3 and b < 0.3:
            circles.append((rect, "H"))
        elif r > 0.7 and 0.3 < g < 0.7 and b < 0.2:
            circles.append((rect, "M"))
        elif r > 0.8 and g > 0.7 and b < 0.3:
            circles.append((rect, "L"))
    return circles

# ---- group blocks into paragraphs ----
def group_blocks_into_paragraphs(blocks, col_split, gap_threshold=5):
    if col_split:
        left  = sorted([b for b in blocks if (b[0]+b[2])/2 <= col_split and b[4].strip() and not is_marker(b)], key=lambda b: b[1])
        right = sorted([b for b in blocks if (b[0]+b[2])/2  > col_split and b[4].strip() and not is_marker(b)], key=lambda b: b[1])
        cols = [("left", left), ("right", right)]
    else:
        all_sorted = sorted([b for b in blocks if b[4].strip() and not is_marker(b)], key=lambda b: b[1])
        cols = [("all", all_sorted)]

    result = []
    for col_name, col_blocks in cols:
        groups = []
        current_group = []
        last_y1 = None
        for b in col_blocks:
            gap = b[1] - last_y1 if last_y1 is not None else 0
            if last_y1 is not None and gap > gap_threshold:
                if current_group:
                    groups.append((col_name, current_group))
                current_group = [b]
            else:
                current_group.append(b)
            last_y1 = max(last_y1 or 0, b[3])
        if current_group:
            groups.append((col_name, current_group))
        result.extend(groups)
    return result

# ---- extract subsection title from dict blocks ----
def get_subsection_title(dict_blocks, first_block, block_has_masks):
    if block_has_masks:
        return None
    by0 = first_block[1]
    for db in dict_blocks:
        if db.get("type") != 0:
            continue
        if abs(db["bbox"][1] - by0) > 3:
            continue
        first_line = db["lines"][0] if db["lines"] else None
        if not first_line:
            continue
        bold_parts = []
        for span in first_line["spans"]:
            is_bold = ('Bold' in span.get('font', '')) or (span.get('flags', 0) & 16)
            txt = span["text"].strip()
            if is_bold and txt not in ('H', 'M', 'L', ''):
                bold_parts.append(txt)
            elif bold_parts:
                break
        if bold_parts:
            title = ' '.join(bold_parts).strip()
            if 2 < len(title) <= 80:
                return title
        # Fallback: em-dash pattern
        text_s = re.sub(r'\s+', ' ', first_block[4].strip())
        for sep in [' – ', ' — ']:
            if sep in text_s:
                t = text_s.split(sep)[0].strip()
                if 2 < len(t) <= 60:
                    return t
    return None

# ---- word masking check ----
def word_is_masked(wx0, wy0, wx1, wy1, para_masks):
    wy_c = (wy0 + wy1) / 2
    for mr in para_masks:
        if wx1 < mr.x0 - 3 or wx0 > mr.x1 + 3:
            continue
        if mr.y0 - 4 <= wy_c <= mr.y1 + 4:
            return True
    return False

# ---- build context string from words ----
def build_context_and_blanks(all_words, para_masks, col_split, col):
    """Returns (context_str, blanks_list) where blanks_list = [answer_str, ...]"""
    # Filter words by column
    if col_split and col != "all":
        all_words = [w for w in all_words if
                     ("right" if (w[0]+w[2])/2 > col_split else "left") == col]

    # Sort: by row (y rounded) then x
    all_words = sorted(all_words, key=lambda w: (round(w[1] / 3) * 3, w[0]))

    blanks = []   # list of answer strings
    blank_idx = 0

    lines_parts = []  # list of lists of tokens
    current_line_parts = []
    current_y = None
    current_mask = None  # accumulating mask words
    pending_newline = False  # line break occurred while inside a mask

    def flush_mask():
        nonlocal current_mask, blank_idx
        if current_mask is not None:
            blank_idx += 1
            current_line_parts.append(f"__BLANK_{blank_idx}__")
            blanks.append(" ".join(current_mask).strip())
            current_mask = None

    # Matches list-item labels: a), b), c), 1), 2), i), ii), etc.
    LIST_LABEL = re.compile(r'^(\d+[).]|[a-z][).]|[ivxlcdm]+[).])$', re.IGNORECASE)

    for w in all_words:
        wx0, wy0, wx1, wy1, wtext = w[0], w[1], w[2], w[3], w[4]
        word_y = round(wy0 / 3) * 3

        masked = word_is_masked(wx0, wy0, wx1, wy1, para_masks)

        # Handle line transition
        if current_y is None:
            current_y = word_y
        elif word_y - current_y > 5:
            current_y = word_y
            if current_mask is None:
                # Not inside a mask → normal line break
                lines_parts.append(current_line_parts)
                current_line_parts = []
                pending_newline = False
            else:
                # Inside a mask spanning multiple lines; remember the line break
                pending_newline = True

        if masked:
            if current_mask is None:
                current_mask = [wtext]
            else:
                current_mask.append(wtext)
            # Masked word on new line → clear pending_newline (mask still ongoing)
            pending_newline = False
        else:
            # Non-masked word: check if mask just ended at a line boundary
            was_in_mask = current_mask is not None
            flush_mask()  # may add __BLANK_N__ to current_line_parts
            if was_in_mask and pending_newline:
                # Mask ended and a line break occurred; add break if next word is a list label
                if LIST_LABEL.match(wtext):
                    lines_parts.append(current_line_parts)
                    current_line_parts = []
            pending_newline = False
            current_line_parts.append(wtext)

    flush_mask()
    if current_line_parts:
        lines_parts.append(current_line_parts)

    context = "\n".join(" ".join(parts) for parts in lines_parts)
    return context, blanks

# ---- main extraction ----
def extract():
    doc_orig   = fitz.open(str(PDF_ORIG))
    doc_marked = fitz.open(str(PDF_MARKED))

    total_pages = min(len(doc_orig), len(doc_marked))
    cards = []
    card_id = 0

    # Cross-page state
    last_section_header = None
    last_right_section_header = None  # right column's last header carries to next page left

    for page_num in range(total_pages):
        page_orig   = doc_orig[page_num]
        page_marked = doc_marked[page_num]
        human_page  = page_num + 1

        subject = get_subject(human_page)
        page_width = page_orig.rect.width
        col_split = page_width / 2  # ~306pt

        # --- green masks ---
        green_masks = get_green_masks(page_marked)

        # --- section headers (black background text) ---
        section_header_rects = get_section_headers(page_marked)
        section_header_texts = {}  # rect_index -> text
        for hr in section_header_rects:
            words_in_header = page_orig.get_text("words", clip=hr)
            section_header_texts[id(hr)] = " ".join(w[4] for w in sorted(words_in_header, key=lambda w: w[0]))

        def get_section_for_rect(rect):
            """Return the most recent section header above this rect, in the same column."""
            best = None
            best_y = -1
            for hr in section_header_rects:
                # Must be in the same horizontal column (overlap in x)
                if hr.x1 < rect.x0 - 20 or hr.x0 > rect.x1 + 20:
                    continue
                if hr.y1 <= rect.y0 + 5:  # header above or at rect top
                    if hr.y1 > best_y:
                        best_y = hr.y1
                        best = section_header_texts[id(hr)]
            return best

        # --- priority circles ---
        priority_circles = get_priority_circles(page_marked)

        def get_priority_for_y(y0, y1, x0, x1):
            for cr, prio in priority_circles:
                if cr.x1 < x0 - 30 or cr.x0 > x1 + 30:
                    continue
                if cr.y0 <= y1 + 5 and cr.y1 >= y0 - 5:
                    return prio
            return None

        # --- text blocks ---
        blocks = page_orig.get_text("blocks")
        dict_blocks = page_orig.get_text("dict")["blocks"]

        # --- paragraph groups ---
        para_groups = group_blocks_into_paragraphs(blocks, col_split)

        # Apply cross-page inheritance: left column of new page uses right column's last header
        # We'll track per-column
        current_left_section  = last_right_section_header or last_section_header
        current_right_section = current_left_section

        # Pending subsection title: a no-mask heading paragraph passes its title
        # to the next masked paragraph in the same column
        pending_subsec_left  = None
        pending_subsec_right = None

        for col, para_group in para_groups:
            if not para_group:
                continue

            para_x0 = min(b[0] for b in para_group)
            para_y0 = min(b[1] for b in para_group)
            para_x1 = max(b[2] for b in para_group)
            para_y1 = max(b[3] for b in para_group)

            # Assign green masks to this paragraph
            para_masks = []
            for mr in green_masks:
                mr_cx = (mr.x0 + mr.x1) / 2
                mr_cy = (mr.y0 + mr.y1) / 2
                if mr_cx < para_x0 - 5 or mr_cx > para_x1 + 5:
                    continue
                if any(b[1] - 2 <= mr_cy <= b[3] + 2 for b in para_group):
                    para_masks.append(mr)

            if not para_masks:
                # Update section header state
                sh = get_section_for_rect(fitz.Rect(para_x0, para_y0, para_x1, para_y1))
                if sh:
                    if col == "left":
                        current_left_section = sh
                    else:
                        current_right_section = sh
                # Extract potential subsectionTitle from this no-mask paragraph (heading candidate)
                cand = get_subsection_title(dict_blocks, para_group[0], False)
                if cand:
                    if col == "left":
                        pending_subsec_left = cand
                    else:
                        pending_subsec_right = cand
                else:
                    # Non-heading no-mask paragraph clears pending title
                    if col == "left":
                        pending_subsec_left = None
                    else:
                        pending_subsec_right = None
                continue

            # Section header for this paragraph
            sh = get_section_for_rect(fitz.Rect(para_x0, para_y0, para_x1, para_y1))
            if sh:
                if col == "left":
                    current_left_section = sh
                else:
                    current_right_section = sh

            section_header = current_left_section if col == "left" else current_right_section

            # Subsection title: try extracting from first block; fall back to pending title
            first_block = para_group[0]
            first_block_masks = [mr for mr in para_masks
                                  if any(b[1] - 2 <= (mr.y0+mr.y1)/2 <= b[3] + 2
                                         for b in [first_block])]
            subsection_title = get_subsection_title(dict_blocks, first_block, bool(first_block_masks))
            if subsection_title is None:
                # Use heading from preceding no-mask paragraph in same column
                subsection_title = pending_subsec_left if col == "left" else pending_subsec_right
            # Consume the pending title
            if col == "left":
                pending_subsec_left = None
            else:
                pending_subsec_right = None

            # Priority
            priority = get_priority_for_y(para_y0, para_y1, para_x0, para_x1)

            # Word extraction
            clip = fitz.Rect(para_x0 - 2, para_y0 - 2, para_x1 + 2, para_y1 + 2)
            all_words = page_orig.get_text("words", clip=clip)
            all_words = [w for w in all_words if w[1] >= para_y0 - 2]

            context, blank_answers = build_context_and_blanks(
                all_words, para_masks, col_split, col)

            if not blank_answers:
                continue

            # Clean context
            context = re.sub(r'  +', ' ', context)
            context = re.sub(r'\n ', '\n', context)
            context = context.strip()

            blanks = [{"idx": i + 1, "answer": ans} for i, ans in enumerate(blank_answers)]

            card_id += 1
            cards.append({
                "id": card_id,
                "page": human_page,
                "subject": subject,
                "sectionHeader": section_header,
                "subsectionTitle": subsection_title,
                "priority": priority,
                "context": context,
                "blanks": blanks,
            })

        # Update cross-page state
        last_section_header = current_right_section or current_left_section
        last_right_section_header = current_right_section

    doc_orig.close()
    doc_marked.close()

    with open(str(OUT_JSON), "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    total_blanks = sum(len(c["blanks"]) for c in cards)
    print(f"Done: {len(cards)} cards, {total_blanks} blanks → {OUT_JSON}")

if __name__ == "__main__":
    extract()
