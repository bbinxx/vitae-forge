/**
 * VitaeForge Google Sheets Sync AppScript
 * Automatically syncs all job applications & full resume JSON templates into Google Sheets.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Paste this code into Code.gs.
 * 4. Click Deploy > New deployment.
 * 5. Select type: Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Click Deploy, authorize permissions, and copy the Web App URL.
 * 7. Paste the Web App URL into VitaeForge PDF / System Settings under "Google Sheets Webhook URL".
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Ensure headers exist
    ensureHeaders(sheet);

    var action = data.action;

    if (action === "sync_all" && data.applications) {
      syncAllApplications(sheet, data.applications);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, synced: data.applications.length }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === "delete" && data.application) {
      deleteApplication(sheet, data.application.id);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, deleted: data.application.id }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (data.application) {
      upsertApplication(sheet, data.application);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, upserted: data.application.id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid payload" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function ensureHeaders(sheet) {
  var headers = [
    "ID",
    "Company",
    "Role",
    "Status",
    "Priority",
    "Date Applied",
    "Contact Name",
    "Contact Email",
    "Job URL",
    "Notes",
    "Resume Template JSON",
    "Updated At"
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
  }
}

function upsertApplication(sheet, app) {
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(app.id)) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  var rowValues = [
    app.id || "",
    app.company || "",
    app.role || "",
    app.status || "",
    app.priority || "",
    app.date_applied || "",
    app.contact_name || "",
    app.contact_email || "",
    app.job_url || "",
    app.notes || "",
    app.resume_template_json || "",
    app.updated_at || new Date().toISOString()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteApplication(sheet, appId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(appId)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function syncAllApplications(sheet, apps) {
  sheet.clearContents();
  ensureHeaders(sheet);
  for (var i = 0; i < apps.length; i++) {
    upsertApplication(sheet, apps[i]);
  }
}
