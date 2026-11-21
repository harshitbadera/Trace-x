$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$buildDir = Join-Path $projectRoot 'tmp/portal-replacements'
$outputPath = Join-Path $projectRoot 'submission/initial-round/Trace-X-Action-Plan.pptx'
$slides = Get-Content -LiteralPath (Join-Path $buildDir 'editable-slides.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function Get-OfficeColor([string]$hex) {
    $value = $hex.TrimStart('#')
    return [Convert]::ToInt32($value.Substring(0,2),16) + 256*[Convert]::ToInt32($value.Substring(2,2),16) + 65536*[Convert]::ToInt32($value.Substring(4,2),16)
}
$pptApp = New-Object -ComObject PowerPoint.Application
$deck = $null
try {
    $deck = $pptApp.Presentations.Add(0)
    $deck.PageSetup.SlideWidth = 960
    $deck.PageSetup.SlideHeight = 540
    foreach ($entry in $slides) {
        $slide = $deck.Slides.Add($deck.Slides.Count+1,12)
        $slide.FollowMasterBackground = 0
        $slide.Background.Fill.Solid()
        $backgroundColor = if ($entry.dark) { '#102136' } else { '#FFFFFF' }
        $slide.Background.Fill.ForeColor.RGB = Get-OfficeColor $backgroundColor
        foreach ($element in $entry.elements) {
            if ($element.type -eq 'image') {
                $shape = $slide.Shapes.AddPicture($element.path,0,-1,($element.x*0.75),($element.y*0.75),($element.w*0.75),($element.h*0.75))
            } else {
                $shape = $slide.Shapes.AddTextbox(1,($element.x*0.75),($element.y*0.75),($element.w*0.75),($element.h*0.75))
                $frame = $shape.TextFrame
                $frame.MarginLeft = 0
                $frame.MarginRight = 0
                $frame.MarginTop = 0
                $frame.MarginBottom = 0
                $frame.AutoSize = 0
                $frame.WordWrap = -1
                $range = $frame.TextRange
                $range.Text = $element.text
                $range.Font.Name = 'Arial'
                $range.Font.Size = $element.size*0.75
                $range.Font.Bold = if ($element.bold) { -1 } else { 0 }
                $range.Font.Color.RGB = Get-OfficeColor $element.color
                $range.ParagraphFormat.Bullet.Visible = 0
                $range.ParagraphFormat.SpaceBefore = 0
                $range.ParagraphFormat.SpaceAfter = 0
                $range.ParagraphFormat.LineRuleWithin = 0
                $range.ParagraphFormat.SpaceWithin = $element.size*1.28*0.75
            }
        }
    }
    $deck.SaveAs($outputPath,24)
    for ($i=1; $i -le $deck.Slides.Count; $i++) {
        $deck.Slides.Item($i).Export((Join-Path $buildDir ('slide-{0:D2}.png' -f $i)),'PNG',1280,720)
    }
    Write-Output "Saved $($deck.Slides.Count) editable slides to $outputPath"
} finally {
    if ($null -ne $deck) { $deck.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($deck) }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($pptApp)
}
