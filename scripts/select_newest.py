#!/usr/bin/env python3
"""Select the newest main meeting record from a Drive folder tree.

Rules (see RULES.md for the plain-language version):
1. Search RECURSIVELY through all subfolders. A file's week identity comes
   from its PARENT folder name first (e.g. "1151027會議議題"), because Drive
   holds several copies of the same-named main file and only the copy whose
   parent is the correct week folder counts.
2. Attachments are never main records: any filename starting with "附件"
   (including full-width forms) is excluded, whatever its date.
3. A main record filename must contain "會議紀錄" or "週會", or a date
   pattern such as 115MMDD / 115.MM.DD, and end with .docx or .pdf.
4. Group candidates by week (parent-folder date, else filename date).
   Pick the newest week by its latest modified time, then by week date.
   Within that week, prefer .docx over .pdf for the same record.
5. Old files left in the folder because nobody deleted them are ignored:
   only the single newest week's main file is returned. Nothing is ever
   published as a separate week from a leftover file.
6. If the newest week folder contains only attachments (as the 1151027
   folder did at first build), there is NO main file for that week and the
   function must say so explicitly instead of silently falling back to
   the previous week's content as "this week".

This module does NOT talk to Google Drive by itself. The caller supplies
a file list (from the Drive API, a Drive export, or the repo input/ folder)
as dicts: {"name", "modified_time" (ISO), "parent", "id"}.
Drive API access itself needs a sharing/credential setup done by Cheng;
no password is ever stored in this repo.
"""
import re
from dataclasses import dataclass

def _norm(s):
    table = str.maketrans("０１２３４５６７８９．", "0123456789.")
    return s.translate(table)

def is_attachment(name):
    return _norm(name).strip().startswith("附件")

def week_date_from(text):
    m = re.search(r"115(\d{2})(\d{2})", _norm(text))
    if m:
        return f"2026-{m.group(1)}-{m.group(2)}"
    m = re.search(r"115\.(\d{1,2})\.(\d{1,2})", _norm(text))
    if m:
        return f"2026-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return None

def is_main_record(name):
    n = _norm(name)
    if is_attachment(n):
        return False
    if not n.lower().endswith((".docx", ".pdf")):
        return False
    return ("會議紀錄" in n) or ("週會" in n) or (week_date_from(n) is not None)

def select_newest(files):
    """Return (chosen_file_dict, note) or (None, note)."""
    cands = []
    for f in files:
        if not is_main_record(f["name"]):
            continue
        week = week_date_from(f.get("parent", "")) or week_date_from(f["name"])
        cands.append({**f, "_week": week})
    if not cands:
        return None, "no main record found (attachments only, or folder empty)"
    # Newest week: latest modified time among its candidates, then week date.
    weeks = {}
    for c in cands:
        weeks.setdefault(c["_week"], []).append(c)
    def week_key(w):
        items = weeks[w]
        return (max(x["modified_time"] for x in items), w or "")
    newest_week = max(weeks, key=week_key)
    items = weeks[newest_week]
    # Within the week, .docx beats .pdf, then newest modified time.
    items.sort(key=lambda x: (1 if x["name"].lower().endswith(".docx") else 0, x["modified_time"]), reverse=True)
    return items[0], f"week={newest_week} files_in_week={len(items)}"

if __name__ == "__main__":
    # Tiny self-test, no network, no credentials.
    files = [
        {"name": "115.09.15會議議題.docx", "modified_time": "2026-09-15T10:00:00Z", "parent": "1150915會議議題", "id": "copy-a"},
        {"name": "115.09.15會議議題.docx", "modified_time": "2026-09-15T10:00:00Z", "parent": "其他資料夾", "id": "copy-b"},
        {"name": "附件01--點燈格式.pdf", "modified_time": "2026-10-27T20:00:00Z", "parent": "1151027會議議題", "id": "att"},
        {"name": "115.10.20會議議題.pdf", "modified_time": "2026-10-20T10:00:00Z", "parent": "1151020會議議題", "id": "old-pdf"},
    ]
    chosen, note = select_newest(files)
    assert chosen["id"] == "old-pdf", chosen
    print("self-test ok:", note, "->", chosen["name"], chosen["parent"])
    # 1151027-style case: only attachments in newest folder -> no main file there
    files2 = [f for f in files if f["parent"] == "1151027會議議題"]
    chosen2, note2 = select_newest(files2)
    assert chosen2 is None, chosen2
    print("attachment-only ok:", note2)
