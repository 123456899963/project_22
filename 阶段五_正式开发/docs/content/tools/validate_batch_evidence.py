# -*- coding: utf-8 -*-
"""批次凭证校验：检查已核验茶品的凭证字段、年份结论与必要附加凭证。"""
import csv
import os
import sys

from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
XLSX = os.path.join(ROOT, "docs", "content", "批次凭证收集台账.xlsx")
REPORT = os.path.join(ROOT, "docs", "content", "批次凭证校验结果.csv")

wb = load_workbook(XLSX, data_only=True)
ws = wb["批次凭证台账"]
rows = []
for r in range(4, ws.max_row + 1):
    tid = ws.cell(r, 2).value
    if not tid:
        continue
    rows.append({
        "row": r, "seq": ws.cell(r, 1).value, "tea": tid, "name": ws.cell(r, 3).value,
        "year": ws.cell(r, 5).value, "required": str(ws.cell(r, 7).value or ""),
        "batch": ws.cell(r, 8).value, "pack": ws.cell(r, 9).value, "inspect": ws.cell(r, 10).value,
        "other": ws.cell(r, 11).value, "issuer": ws.cell(r, 12).value, "issue_date": ws.cell(r, 13).value,
        "verifier": ws.cell(r, 14).value, "verify_date": ws.cell(r, 15).value,
        "status": str(ws.cell(r, 16).value or "").strip(), "conclusion": str(ws.cell(r, 17).value or "").strip(),
        "note": ws.cell(r, 18).value,
    })

issues = []
for item in rows:
    if item["status"] != "已核验":
        continue
    probs = []
    for key, label in (("batch", "批次记录"), ("pack", "包装/标签照片"), ("inspect", "检验报告")):
        if not str(item[key] or "").strip():
            probs.append("缺少" + label)
    if any(k in item["required"] for k in ("仓储", "原产地", "进口", "原料年度", "地理标志")):
        if not str(item["other"] or "").strip():
            probs.append("缺少其他凭证（仓储/原产地/进口/原料年度）")
    for key, label in (("issuer", "出具单位"), ("issue_date", "出具日期"), ("verifier", "核验人"), ("verify_date", "核验日期")):
        if not str(item[key] or "").strip():
            probs.append("缺少" + label)
    if item["conclusion"] != "年份一致":
        probs.append("核验结论不是「年份一致」")
    if probs:
        issues.append({"item": item, "problems": probs})

with open(REPORT, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["序号", "茶品ID", "茶品", "年份", "状态", "核验结论", "问题"])
    for item in rows:
        probs = next((x["problems"] for x in issues if x["item"]["row"] == item["row"]), [])
        w.writerow([item["seq"], item["tea"], item["name"], item["year"], item["status"],
                    item["conclusion"], "；".join(probs)])

verified = sum(1 for x in rows if x["status"] == "已核验")
collected = sum(1 for x in rows if x["status"] == "已收集")
pending = sum(1 for x in rows if x["status"] == "待收集")
na = sum(1 for x in rows if x["status"] == "不适用")
print("批次凭证校验")
print("茶品总数：%d；已核验：%d；已收集：%d；待收集：%d；不适用：%d" % (len(rows), verified, collected, pending, na))
print("已核验项问题：%d 条" % len(issues))
for x in issues:
    print("  %s：%s" % (x["item"]["tea"], "、".join(x["problems"])))
print("报告：%s" % REPORT)
sys.exit(0 if not issues else 1)
