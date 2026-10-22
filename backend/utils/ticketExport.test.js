import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { CSV_BOM, CSV_COLUMNS, csvCell, csvHeader, exportFilename, ticketRecord, ticketsCsv, ticketsJson, ticketsMarkdown } from "./ticketExport.js";

const userId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();
const ticket = {
  _id: new mongoose.Types.ObjectId(),
  userId: { _id: userId, username: "şükrü", accountTier: "plus" },
  type: "Bug Report",
  title: "Liste açılmıyor, çöküyor",
  description: 'Uygulama "Izlenecekler" ekranında donuyor.\nİkinci satır: ğ ı ö ş ü ç',
  status: "In Progress",
  adminReply: "Bakıyoruz",
  replies: [{ text: "Bakıyoruz", adminId: { _id: adminId, username: "mod" }, createdAt: new Date("2026-10-02T10:00:00Z") }],
  repliedAt: new Date("2026-10-02T10:00:00Z"),
  statusChangedAt: new Date("2026-10-02T10:00:00Z"),
  createdAt: new Date("2026-10-01T09:30:00Z"),
  updatedAt: new Date("2026-10-02T10:00:00Z"),
};
const meta = { exportedAt: new Date("2026-10-20T17:39:00Z"), filters: { status: "In Progress" } };

test("a ticket is flattened to who wrote it, never their email or devices", () => {
  const record = ticketRecord({ ...ticket, userId: { ...ticket.userId, email: "a@b.c", devices: [{ token: "x" }] } });
  assert.deepEqual(record.user, { id: String(userId), username: "şükrü", accountTier: "plus" });
  assert.deepEqual(record.replies, [{ text: "Bakıyoruz", admin: "mod", createdAt: "2026-10-02T10:00:00.000Z" }]);
  assert.equal(record.latestReply, "Bakıyoruz");
  assert.deepEqual(record.attachments, []);
  assert.ok(!JSON.stringify(record).includes("a@b.c"));
});

test("a deleted account still exports, by id", () => {
  const unpopulated = ticketRecord({ ...ticket, userId: null, replies: [] });
  assert.deepEqual(unpopulated.user, { id: null, username: null, accountTier: null });
  const bareId = ticketRecord({ ...ticket, userId });
  assert.equal(bareId.user.id, String(userId));
  assert.equal(bareId.user.username, null);
});

test("an older ticket with only adminReply keeps it as its latest reply", () => {
  assert.equal(ticketRecord({ ...ticket, replies: undefined }).latestReply, "Bakıyoruz");
  assert.equal(ticketRecord({ ...ticket, adminReply: undefined, replies: [] }).latestReply, null);
});

test("cells with commas, quotes and line breaks are quoted", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a, b"), '"a, b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("one\ntwo"), '"one\ntwo"');
  assert.equal(csvCell("one\r\ntwo"), '"one\r\ntwo"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(0), "0");
});

test("cells a spreadsheet would run as a formula are neutralised", () => {
  for (const start of ["=", "+", "-", "@", "\t", "\r"]) {
    assert.ok(csvCell(`${start}SUM(A1)`).replace(/^"/, "").startsWith(`'${start}`), JSON.stringify(start));
  }
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("a=b"), "a=b");
});

test("the CSV starts with a BOM and keeps Turkish characters intact", () => {
  const csv = ticketsCsv([ticketRecord(ticket)]);
  assert.ok(csv.startsWith(CSV_BOM));
  assert.ok(csv.slice(1).startsWith(csvHeader()));
  assert.ok(csv.includes("şükrü"));
  assert.ok(csv.includes("ğ ı ö ş ü ç"));
  assert.equal(csvHeader().trim().split(",").length, CSV_COLUMNS.length);
  assert.ok(csvHeader().includes("attachments"));
});

// A minimal RFC 4180 reader, to check the CSV round-trips.
function parseCsv(text) {
  const rows = [[]];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") rows.at(-1).push(cell), (cell = "");
    else if (c === "\r" && text[i + 1] === "\n") rows.at(-1).push(cell), (cell = ""), rows.push([]), i++;
    else cell += c;
  }
  return rows.filter((row) => row.length);
}

test("the CSV reads back to the same text, one cell per column", () => {
  const rows = parseCsv(ticketsCsv([ticketRecord({ ...ticket, title: '=cmd, "quoted"' })]).slice(1));
  assert.equal(rows.length, 2);
  assert.equal(rows[1].length, CSV_COLUMNS.length);
  const at = (name) => rows[1][CSV_COLUMNS.findIndex(([column]) => column === name)];
  assert.equal(at("description"), ticket.description);
  assert.equal(at("title"), `'=cmd, "quoted"`);
  assert.equal(at("replyCount"), "1");
  assert.equal(at("attachments"), "");
});

test("JSON carries the filters and every ticket in full", () => {
  const parsed = JSON.parse(ticketsJson([ticketRecord(ticket)], meta));
  assert.equal(parsed.count, 1);
  assert.deepEqual(parsed.filters, { status: "In Progress" });
  assert.equal(parsed.exportedAt, "2026-10-20T17:39:00.000Z");
  assert.equal(parsed.tickets[0].description, ticket.description);
});

test("Markdown gives each ticket its own section, with people's text quoted", () => {
  const md = ticketsMarkdown([ticketRecord({ ...ticket, description: "# not a heading\nsecond line" })], meta);
  assert.ok(md.includes(`## ${ticket.title} (${ticket._id})`));
  assert.ok(md.includes("> # not a heading\n> second line"));
  assert.ok(md.includes("- **User:** @şükrü · plus"));
  assert.ok(md.includes("**@mod** · 2026-10-02T10:00:00.000Z"));
  assert.ok(md.includes("### Attachments\n\nNone"));
  assert.ok(md.includes("- Filters: status: In Progress"));
  assert.ok(ticketsMarkdown([], { exportedAt: meta.exportedAt, filters: {} }).includes("none (all tickets)"));
});

test("the file name is in the admin's own time", () => {
  const now = new Date("2026-10-20T17:39:00Z");
  assert.equal(exportFilename("zip", now), "tickets-export-2026-10-20-1739.zip");
  // Istanbul is UTC+3: getTimezoneOffset() is -180.
  assert.equal(exportFilename("csv", now, -180), "tickets-export-2026-10-20-2039.csv");
  assert.equal(exportFilename("csv", new Date("2026-10-20T22:05:00Z"), -180), "tickets-export-2026-10-21-0105.csv");
});

test("a manual ticket exports like any other, marked manual, with who added it and where it came from", () => {
  const manualTicket = {
    ...ticket,
    _id: new mongoose.Types.ObjectId(),
    title: "Arkadaş önerisi: liste sıralaması",
    description: "Çğıöşü, \"alıntı\"\nikinci satır",
    userId: null,
    adminReply: undefined,
    replies: [],
    manual: true,
    createdByAdmin: { _id: adminId, username: "mod" },
    source: "Friend feedback, via WhatsApp",
  };
  const records = [ticketRecord(ticket), ticketRecord(manualTicket)];
  assert.equal(records[0].manual, false);
  assert.equal(records[0].createdByAdmin, null);
  assert.deepEqual(
    [records[1].manual, records[1].createdByAdmin, records[1].source, records[1].user.id],
    [true, "mod", "Friend feedback, via WhatsApp", null]
  );

  const rows = parseCsv(ticketsCsv(records).slice(1));
  assert.equal(rows.length, 3);
  const at = (row, name) => rows[row][CSV_COLUMNS.findIndex(([column]) => column === name)];
  assert.deepEqual([at(1, "manual"), at(1, "createdByAdmin"), at(1, "source")], ["false", "", ""]);
  assert.deepEqual([at(2, "manual"), at(2, "createdByAdmin"), at(2, "source")], ["true", "mod", "Friend feedback, via WhatsApp"]);
  assert.equal(at(2, "title"), manualTicket.title);
  assert.equal(at(2, "description"), manualTicket.description);
  assert.equal(at(2, "username"), "");

  const json = JSON.parse(ticketsJson(records, meta));
  assert.equal(json.tickets[1].manual, true);
  assert.equal(json.tickets[1].description, manualTicket.description);

  const md = ticketsMarkdown(records, meta);
  assert.ok(md.includes("- **User:** (none)"));
  assert.ok(md.includes("- **Added manually by:** @mod"));
  assert.ok(md.includes("- **Source:** Friend feedback, via WhatsApp"));
  assert.ok(md.includes("> Çğıöşü"));
});
