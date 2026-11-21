// SYNTHETIC biometric page, shaped like the campus site's HTML. Roll number, rooms and times are
// invented. Never paste the real saved page or its punches into this file.

export const punchPageHtml = `<!DOCTYPE html>
<html><head><title>The NorthCap University</title></head>
<body>
<table class="table">
  <tbody>
    <tr class="btn-primary">
      <td colspan="9" align="center">
        <b>Biometric Attendance (Raw Punch)</b><br>[01-Sep-2026 00:00:00 To 03-Sep-2026 23:59:59]
        <br>[ Roll No : SAMPLE001]
      </td>
    </tr>
    <tr class="btn-primary">
      <th colspan="7" align="left">
        <form method="get" action="https://biometric.example.test/">
          <table>
            <tbody><tr>
              <td>Start Date:</td>
              <td><input name="date1" id="date1" value="01-Sep-2026 00:00:00"></td>
              <td>End Date:</td>
              <td><input name="date2" id="date2" value="03-Sep-2026 23:59:59"></td>
              <td>Select Roll No/Room No:</td>
              <td><select id="SearchType" name="SearchType"><option selected="selected" value="Roll No">Roll No</option></select></td>
              <td><input type="text" name="search" id="search"></td>
              <td><button type="submit">Search</button></td>
            </tr></tbody>
          </table>
        </form>
      </th>
    </tr>
    <tr>
      <th>Roll No</th>
      <th>Room No</th>
      <th>Punch Time</th>
    </tr>
    <tr>

      <td>
        SAMPLE001
      </td>
      <td>
        R-101
      </td>
      <td>
        03-Sep-2026 09:05:10
      </td>
    </tr>
    <tr>

      <td>
        SAMPLE001
      </td>
      <td>
        Lab &amp; Studio
      </td>
      <td>
        03-Sep-2026 11:40:00
      </td>
    </tr>
    <tr>

      <td>
        SAMPLE001
      </td>
      <td>
        R-101
      </td>
      <td>
        02-Sep-2026 08:30:00
      </td>
    </tr>
    <tr>

      <td>
        SAMPLE001
      </td>
      <td>
        Library
      </td>
      <td>
        02-Sep-2026 16:15:42
      </td>
    </tr>
  </tbody>
</table>
</body></html>`;

export const emptyPunchPageHtml = `<table class="table"><tbody>
  <tr class="btn-primary"><td colspan="9">[ Roll No : SAMPLE001]</td></tr>
  <tr><th>Roll No</th><th>Room No</th><th>Punch Time</th></tr>
</tbody></table>`;

export const unexpectedPageHtml = '<html><body><h1>Service unavailable</h1></body></html>';
