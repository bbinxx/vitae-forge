/**
 * VitaeForge Google Sheets Sync AppScript
 * Automatically syncs all job applications & full resume JSON templates into Google Sheets.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Replace all existing code with this file content.
 * 4. Click Deploy > New deployment.
 * 5. Select type: Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Click Deploy, authorize permissions, and copy the Web App URL.
 * 7. Paste the Web App URL into VitaeForge Settings under "Google Sheets Webhook URL".
 */

function doGet(e) {
  if (e && e.parameter && e.parameter.payload) {
    try {
      var data = JSON.parse(e.parameter.payload);
      return processPayload(data);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true, status: "VitaeForge Google Sheets Sync Active" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e && e.postData ? e.postData.contents : "";
    if (!contents && e && e.parameter && e.parameter.payload) {
      contents = e.parameter.payload;
    }
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Empty request payload" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = JSON.parse(contents);
    return processPayload(data);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function processPayload(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  ensureHeaders(sheet);

  var action = data.action;

  if (action === "sync_all" && data.applications) {
    syncAllApplications(sheet, data.applications);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, count: data.applications.length, message: "Synced all applications" }))
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

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid payload action" }))
    .setMimeType(ContentService.MimeType.JSON);
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
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#3b82f6");
    headerRange.setFontColor("#ffffff");
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
