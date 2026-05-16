param(
  [Parameter(Mandatory=$true)][string]$Workbook,
  [Parameter(Mandatory=$true)][string]$OutFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ColIndex([string]$cellRef) {
  $letters = ([regex]::Match($cellRef, '^[A-Z]+')).Value
  $n = 0
  foreach ($ch in $letters.ToCharArray()) {
    $n = ($n * 26) + ([int][char]$ch - [int][char]'A' + 1)
  }
  return $n - 1
}

function Convert-Value($value) {
  if ($null -eq $value) { return $null }
  $s = [string]$value
  $trim = $s.Trim()
  if ($trim -eq '') { return $null }
  if ($trim -match '^[$]?\s*-?[0-9][0-9\s,.]*$') {
    $clean = $trim -replace '[^0-9.\-]', ''
    $number = 0.0
    if ([double]::TryParse($clean, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
      return $number
    }
  }
  return $s
}

function Convert-ExcelDate($serial) {
  if ($null -eq $serial) { return $null }
  $n = [double]$serial
  return ([datetime]'1899-12-30').AddDays($n).ToString('yyyy-MM-dd')
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$fullWorkbook = (Resolve-Path $Workbook).Path
$zip = [System.IO.Compression.ZipFile]::OpenRead($fullWorkbook)

try {
  function Read-ZipText([string]$entryName) {
    $entry = $zip.GetEntry($entryName)
    if (-not $entry) { return $null }
    $reader = [System.IO.StreamReader]::new($entry.Open())
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
  }

  function CellText($cell, $shared) {
    $vNode = $cell.SelectSingleNode('*[local-name()="v"]')
    $v = if ($vNode) { $vNode.InnerText } else { '' }
    $t = $cell.GetAttribute('t')
    if ($t -eq 's' -and $v -ne '') { return $shared[[int]$v] }
    if ($t -eq 'inlineStr') {
      $tn = $cell.SelectSingleNode('*[local-name()="is"]/*[local-name()="t"]')
      if ($tn) { return $tn.InnerText }
    }
    return $v
  }

  function SheetRows([string]$path, $shared) {
    [xml]$ws = Read-ZipText $path
    $rows = @()
    foreach ($row in $ws.worksheet.sheetData.row) {
      $values = @()
      foreach ($cell in $row.c) {
        $idx = Get-ColIndex $cell.r
        while ($values.Count -le $idx) { $values += $null }
        $values[$idx] = Convert-Value (CellText $cell $shared)
      }
      $rows += ,$values
    }
    return $rows
  }

  $shared = @()
  $sharedXml = Read-ZipText 'xl/sharedStrings.xml'
  if ($sharedXml) {
    [xml]$sx = $sharedXml
    foreach ($si in $sx.sst.si) {
      $texts = @()
      foreach ($node in $si.SelectNodes('.//*[local-name()="t"]')) { $texts += $node.InnerText }
      $shared += ($texts -join '')
    }
  }

  [xml]$wb = Read-ZipText 'xl/workbook.xml'
  [xml]$rels = Read-ZipText 'xl/_rels/workbook.xml.rels'
  $relMap = @{}
  foreach ($rel in $rels.Relationships.Relationship) { $relMap[$rel.Id] = $rel.Target }

  $sheets = @{}
  foreach ($sheet in $wb.workbook.sheets.sheet) {
    $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $target = $relMap[$rid]
    $path = if ($target.StartsWith('/')) { $target.TrimStart('/') } else { 'xl/' + $target }
    $sheets[[string]$sheet.name] = SheetRows $path $shared
  }

  $usersById = @{}
  $demoRows = $sheets['Demographics']
  $demoHeaders = $demoRows[0]
  for ($i = 1; $i -lt $demoRows.Count; $i++) {
    $row = $demoRows[$i]
    if (-not $row[0]) { continue }
    $user = [ordered]@{}
    for ($c = 0; $c -lt $demoHeaders.Count; $c++) {
      $key = [string]$demoHeaders[$c]
      if ($key) { $user[$key] = $row[$c] }
    }
    $firstName = ([string]$user['Full Name']).Split(' ')[0]
    $incomeKey = @($user.Keys | Where-Object { $_ -like 'Monthly Income*' })[0]
    $usersById[[string]$user['User ID']] = [ordered]@{
      userId = [string]$user['User ID']
      fullName = [string]$user['Full Name']
      firstName = $firstName
      age = [int]$user['Age']
      city = [string]$user['City']
      occupation = [string]$user['Occupation']
      education = [string]$user['Education']
      monthlyIncome = [double]$user[$incomeKey]
      incomeSource = [string]$user['Income Source']
      nordeaTier = [string]$user['Nordea Tier']
      savingsGoal = [string]$user['Savings Goal']
      familyStatus = [string]$user['Family Status']
      riskProfile = [string]$user['Risk Profile']
      transactions = @()
      annualSummary = $null
      monthlyCategories = @()
    }
  }

  $txRows = $sheets['All Transactions']
  $txHeaders = $txRows[0]
  for ($i = 1; $i -lt $txRows.Count; $i++) {
    $row = $txRows[$i]
    if (-not $row[0]) { continue }
    $uid = [string]$row[0]
    if (-not $usersById.Contains($uid)) { continue }
    $usersById[$uid].transactions += [ordered]@{
      date = Convert-ExcelDate $row[2]
      description = [string]$row[3]
      category = [string]$row[4]
      type = [string]$row[5]
      amount = [double]$row[6]
      runningBalance = [double]$row[7]
    }
  }

  $annualRows = $sheets['Annual Summary']
  for ($i = 2; $i -lt $annualRows.Count; $i++) {
    $row = $annualRows[$i]
    if (-not $row[0]) { continue }
    $uid = [string]$row[0]
    if (-not $usersById.Contains($uid)) { continue }
    $usersById[$uid].annualSummary = [ordered]@{
      totalIncome = [double]$row[5]
      totalExpenses = [double]$row[6]
      netSaved = [double]$row[7]
      savingsRate = [double]$row[8]
    }
  }

  $pivotRows = $sheets['Monthly Category Pivot']
  $months = @('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec')
  for ($i = 2; $i -lt $pivotRows.Count; $i++) {
    $row = $pivotRows[$i]
    if (-not $row[0]) { continue }
    $first = [string]$row[0]
    $user = $usersById.Values | Where-Object { $_.firstName -eq $first } | Select-Object -First 1
    if (-not $user) { continue }
    $monthly = [ordered]@{}
    for ($m = 0; $m -lt 12; $m++) { $monthly[$months[$m]] = if ($row[$m + 2]) { [double]$row[$m + 2] } else { 0 } }
    $user.monthlyCategories += [ordered]@{
      category = [string]$row[1]
      monthly = $monthly
      total = [double]$row[14]
    }
  }

  $users = @($usersById.Values | Sort-Object userId)
  foreach ($u in $users) {
    $u['persona'] = [ordered]@{
      likelyInvestmentBlocker = switch -Regex ($u.riskProfile) {
        'low' { 'confusion, fear of losing money, and concern that the amount is too small'; break }
        'medium-high' { 'skepticism about whether an AI should guide retirement decisions'; break }
        default { 'not getting around to it and wanting a practical plan first' }
      }
      conversationStyle = switch ($u.firstName) {
        'Emma' { 'honest, slightly anxious, curious, budget-sensitive' }
        'Mikael' { 'practical, concise, tech-comfortable, open to automation' }
        'Aino' { 'careful, busy, family-oriented, goal-driven' }
        'Pekka' { 'skeptical, responsible, values clarity and control' }
        'Sofia' { 'warm, practical, low-risk, wants simple steps' }
        default { 'natural and cautious' }
      }
      approvalTendency = switch -Regex ($u.riskProfile) {
        'low' { 'approves small savings drafts, asks for education before investment drafts'; break }
        'medium-high' { 'edits recommendations downward or asks for human-advisor framing'; break }
        default { 'approves if the plan is clearly explained and reversible' }
      }
    }
  }

  $result = [ordered]@{
    sourceWorkbook = $fullWorkbook
    importedAt = (Get-Date).ToString('o')
    users = $users
  }

  $outDir = Split-Path -Parent $OutFile
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  $result | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 -Path $OutFile
  Write-Output "Imported $($users.Count) users to $OutFile"
}
finally {
  $zip.Dispose()
}

