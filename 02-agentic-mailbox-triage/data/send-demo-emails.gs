/**
 * uipath-dev / 02-agentic-mailbox-triage — demo e-mail sender (Google Apps Script).
 *
 * 
 */

const TO = 'uibot778+ap@gmail.com';
const SHEET_NAME = 'DemoEmails';
const ATTACHMENTS_FOLDER_ID = 'PUT_FOLDER_ID_HERE';
const PAUSE_MS = 3000;

function sendDevSet() { sendWhere_(r => r.DevSet === 'Y'); }
function sendAll() { sendWhere_(() => true); }
function sendCase(n) { sendWhere_(r => Number(r.Case) === Number(n)); }
function sendCase1() { sendCase(1); } // handy for the Run button

function sendWhere_(predicate) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getDisplayValues();
  const header = values[0];
  const sentAtCol = header.indexOf('SentAt');
  const aliases = GmailApp.getAliases();
  const folder = DriveApp.getFolderById(ATTACHMENTS_FOLDER_ID);

  for (let i = 1; i < values.length; i++) {
    const row = Object.fromEntries(header.map((h, j) => [h, values[i][j]]));
    if (!row.Case || !predicate(row)) continue;

    if (!aliases.includes(row.From)) {
      throw new Error(`Case ${row.Case}: ${row.From} is not in "Send mail as" aliases`);
    }
    const attachments = row.Attachments
      ? row.Attachments.split(';').map(name => {
          const files = folder.getFilesByName(name.trim());
          if (!files.hasNext()) throw new Error(`Case ${row.Case}: attachment ${name} not found`);
          return files.next().getBlob();
        })
      : [];

    GmailApp.sendEmail(TO, row.Subject, row.Body, { from: row.From, name: row.FromName, attachments });
    Logger.log(`Sent case ${row.Case}: ${row.Subject}`);
    if (sentAtCol >= 0) {
      sheet.getRange(i + 1, sentAtCol + 1)
        .setValue(Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM-dd HH:mm:ss'));
    }
    Utilities.sleep(PAUSE_MS);
  }
}
