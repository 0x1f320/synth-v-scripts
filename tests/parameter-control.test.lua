-- Match the host fallback path and keep all preset writes in memory.
debug.getinfo = function() return { source = "[string host-script]", short_src = "host-script" } end
os.getenv = function() return "/test" end
local files = {
 ["/project.svp"] = [[{"tracks":[{"mainRef":{"groupID":"track-a","database":{"name":"Kasane Teto AI 2"}},"groups":[{"groupID":"group-a","blickOffset":0,"database":{"name":""}},{"groupID":"group-b","blickOffset":0,"database":{"name":""}}]}]}]],
}
local groupId = "group-a"
local projectPath = "/project.svp"
local watchTimer
local timer
local dialogCallback, dialogForm
io.open = function(path, mode)
 if mode == "r" and files[path] == nil then return nil end
 return { read=function() return files[path] end, write=function(_, text) files[path]=text end, close=function() end }
end
SV = {
 create=function()
  local value,callback
  return { getValue=function() return value end, setValue=function(_,v) value=v; if callback then callback(v) end end,
   setEnabled=function() end, setValueChangeCallback=function(_,c) callback=c end }
 end,
 getProject=function() return {getFileName=function() return projectPath end} end,
 getMainEditor=function() return {
  getCurrentGroup=function() return {
   getTarget=function() return {getUUID=function() return groupId end} end,
   getVoice=function() return {vocalModeParams={Power={},Mellow={}}} end,
   getTimeOffset=function() return 0 end,
   getParent=function() return {getGroupReference=function(_,index)
    assert(index==1); return {getTarget=function() return {getUUID=function() return "track-a" end} end} end} end
  } end,
  getSelection=function() return {getSelectedGroups=function() return {} end,getSelectedNotes=function() return {} end,
    registerSelectionCallback=function() end,registerClearCallback=function() end} end
 } end,
 refreshSidePanel=function() end,
 setTimeout=function(_,delay,callback) if delay==16 then timer=callback elseif delay==500 then watchTimer=callback end end,
 showCustomDialogAsync=function(_,form,callback) dialogForm=form;dialogCallback=callback end
}
dofile("dist/parameter-control.lua")
local function widgets()
 local result={}
 for _,row in ipairs(getSidePanelSectionState().rows) do
  for _,w in ipairs(row.columns or {row}) do result[#result+1]=w end
 end
 return result
end
for _,w in ipairs(widgets()) do if w.text=="Define Preset..." then w.value:setValue(true) end end
timer()
local answers={name="Lua Native Preset"}
for _,w in ipairs(dialogForm.widgets) do if w.type=="Slider" then answers[w.name]=10;break end end
dialogCallback({status="Ok",answers=answers})
groupId="group-b"
local found=false
for _,w in ipairs(widgets()) do
 if w.type=="ComboBox" then for _,label in ipairs(w.choices) do if label=="Preset: Lua Native Preset" then found=true end end end
end
assert(found,"preset missing after native Lua group switch")
print("PASS: compiled Lua loads database.name without JSON and shares presets across groups")

groupId="unsaved-group"
for _,w in ipairs(widgets()) do
 if w.type=="ComboBox" then for _,label in ipairs(w.choices) do assert(not label:find("Preset: Lua Native Preset",1,true)) end end
end
for path,_ in pairs(files) do
 assert(not path:find(".parameter-control.group-",1,true), "unexpected group store")
 assert(not path:find(".parameter-control.unknown-",1,true), "unexpected unknown store")
end
groupId="group-a"
local restored=false
for _,w in ipairs(widgets()) do
 if w.type=="ComboBox" then for _,label in ipairs(w.choices) do if label=="Preset: Lua Native Preset" then restored=true end end end
end
assert(restored,"preset missing after returning to known bank")
print("PASS: compiled Lua never falls back to group or unknown stores")

local sawName=false
for _,w in ipairs(widgets()) do if w.type=="Label" and w.text=="Presets: Kasane Teto AI 2 (last saved project)" then sawName=true end end
assert(sawName,"inherited bank name must not be empty in Lua")
files["/other.svp"] = [[{"tracks":[{"mainRef":{"groupID":"track-a","database":{"name":"Other Voice"}},"groups":[{"groupID":"group-a","database":{"name":""}}]}]}]]
projectPath="/other.svp"
watchTimer()
local sawOtherName=false
for _,w in ipairs(widgets()) do if w.type=="Label" and w.text=="Presets: Other Voice (last saved project)" then sawOtherName=true end end
assert(sawOtherName,"explicit Other Voice label missing in Lua")
for _,w in ipairs(widgets()) do
 if w.type=="ComboBox" then for _,label in ipairs(w.choices) do assert(label~="Preset: Lua Native Preset", "different voicebanks must not share presets in Lua") end end
end
projectPath="/project.svp"
watchTimer()
local foundAgain=false
for _,w in ipairs(widgets()) do
 if w.type=="ComboBox" then for _,label in ipairs(w.choices) do if label=="Preset: Lua Native Preset" then foundAgain=true end end end
end
assert(foundAgain,"returning across SVPs must restore bank presets")
print("PASS: Lua inherits nonempty bank names and isolates different banks across SVPs")

files["/blank.svp"] = [[{"tracks":[{"mainRef":{"groupID":"track-a","database":{"name":""}},"groups":[{"groupID":"group-a","database":{"name":" "}}]}]}]]
projectPath="/blank.svp"
watchTimer()
local unavailable=false
for _,w in ipairs(widgets()) do
 if w.type=="Label" and w.text=="Presets unavailable: assign a voicebank and save the project." then unavailable=true end
 if w.type=="ComboBox" then for _,label in ipairs(w.choices) do assert(not label:find("Preset:",1,true),"blank bank must not show presets") end end
end
assert(unavailable,"blank saved bank must be unavailable in Lua")
print("PASS: blank saved bank names never create a shared fallback")
