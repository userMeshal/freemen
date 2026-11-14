#include "Profile.h"
#include "KeyValue.h"

#include <cstdio>
#include <filesystem>

namespace wz {

const char* adsTransitionName(int v) {
    switch (v) { case 1: return "Gradual"; case 2: return "After Zoom"; default: return "Instant"; }
}

const char* aimAssistTypeName(int v) {
    switch (v) { case 1: return "Precision"; case 2: return "Focusing"; case 3: return "Black Ops"; default: return "Default"; }
}

static double roundTo(double v, double step) { return std::round(v / step) * step; }

void Profile::sanitize() {
    sensH = (int)clampd(sensH, 1, 20);
    sensV = (int)clampd(sensV, 1, 20);
    adsMult = clampd(roundTo(adsMult, 0.01), 0.10, 2.00);
    adsMultHigh = clampd(roundTo(adsMultHigh, 0.01), 0.10, 2.00);
    adsTransition = (int)clampd(adsTransition, 0, 2);
    int c = (int)curve;
    if (c < 0 || c > 2) curve = CurveType::Standard;
    lsMin = clampd(roundTo(lsMin, 0.01), 0.0, 0.50);
    rsMin = clampd(roundTo(rsMin, 0.01), 0.0, 0.50);
    lsMax = clampd(roundTo(lsMax, 0.01), 0.55, 0.99);
    rsMax = clampd(roundTo(rsMax, 0.01), 0.55, 0.99);
    ltDz = clampd(roundTo(ltDz, 0.01), 0.0, 0.50);
    rtDz = clampd(roundTo(rtDz, 0.01), 0.0, 0.50);
    aimAssistType = (int)clampd(aimAssistType, 0, 3);
    bias = clampd(bias, -1.0, 1.0);
    trainerFov = clampd(trainerFov, 60.0, 120.0);
    if (name.empty()) name = "Unnamed";
}

std::string Profile::serialize() const {
    KeyValue kv;
    kv.set("format", "wzprofile-1");
    kv.set("name", name);
    kv.set("notes", notes);
    kv.setInt("sensH", sensH);
    kv.setInt("sensV", sensV);
    kv.setNum("adsMult", adsMult);
    kv.setNum("adsMultHigh", adsMultHigh);
    kv.setInt("adsTransition", adsTransition);
    kv.setInt("curve", (int)curve);
    kv.setNum("lsMin", lsMin); kv.setNum("lsMax", lsMax);
    kv.setNum("rsMin", rsMin); kv.setNum("rsMax", rsMax);
    kv.setNum("ltDz", ltDz);   kv.setNum("rtDz", rtDz);
    kv.setInt("aimAssist", aimAssist ? 1 : 0);
    kv.setInt("aimAssistType", aimAssistType);
    kv.setNum("bias", bias);
    kv.setNum("trainerFov", trainerFov);
    return kv.serialize();
}

Profile Profile::parse(const std::string& text) {
    KeyValue kv = KeyValue::parse(text);
    Profile p;
    p.name = kv.get("name", p.name);
    p.notes = kv.get("notes");
    p.sensH = (int)kv.getInt("sensH", p.sensH);
    p.sensV = (int)kv.getInt("sensV", p.sensV);
    p.adsMult = kv.getNum("adsMult", p.adsMult);
    p.adsMultHigh = kv.getNum("adsMultHigh", p.adsMultHigh);
    p.adsTransition = (int)kv.getInt("adsTransition", p.adsTransition);
    p.curve = (CurveType)kv.getInt("curve", (int)p.curve);
    p.lsMin = kv.getNum("lsMin", p.lsMin); p.lsMax = kv.getNum("lsMax", p.lsMax);
    p.rsMin = kv.getNum("rsMin", p.rsMin); p.rsMax = kv.getNum("rsMax", p.rsMax);
    p.ltDz = kv.getNum("ltDz", p.ltDz);    p.rtDz = kv.getNum("rtDz", p.rtDz);
    p.aimAssist = kv.getInt("aimAssist", 1) != 0;
    p.aimAssistType = (int)kv.getInt("aimAssistType", p.aimAssistType);
    p.bias = kv.getNum("bias", p.bias);
    p.trainerFov = kv.getNum("trainerFov", p.trainerFov);
    p.sanitize();
    return p;
}

std::vector<Profile> builtinPresets() {
    std::vector<Profile> v;
    {
        Profile p; p.name = "Game Default";
        p.notes = "Out-of-the-box style values. Use this as your baseline if you never changed settings.";
        v.push_back(p);
    }
    {
        Profile p; p.name = "Balanced Tracker";
        p.sensH = 6; p.sensV = 6; p.adsMult = 0.95; p.adsMultHigh = 0.90;
        p.curve = CurveType::Dynamic; p.adsTransition = 0;
        p.lsMin = 0.04; p.rsMin = 0.04; p.bias = 0.0;
        p.notes = "All-round starting point: Dynamic curve, moderate sensitivity, slightly reduced ADS speed for steadier tracking.";
        v.push_back(p);
    }
    {
        Profile p; p.name = "Precision / Long Range";
        p.sensH = 5; p.sensV = 5; p.adsMult = 0.85; p.adsMultHigh = 0.80;
        p.curve = CurveType::Standard; p.adsTransition = 1;
        p.lsMin = 0.05; p.rsMin = 0.05; p.bias = -0.7;
        p.notes = "Slower, steadier aim for AR/LMG beams at range. Standard curve gives the finest control near stick centre.";
        v.push_back(p);
    }
    {
        Profile p; p.name = "Aggressive / Close Range";
        p.sensH = 8; p.sensV = 7; p.adsMult = 1.00; p.adsMultHigh = 0.90;
        p.curve = CurveType::Dynamic; p.adsTransition = 0;
        p.lsMin = 0.03; p.rsMin = 0.03; p.bias = 0.7;
        p.notes = "Faster turning for SMG fights and quick target swaps. Needs a clean (drift-free) stick for the low deadzone.";
        v.push_back(p);
    }
    for (auto& p : v) p.sanitize();
    return v;
}

std::string exportCheatSheet(const Profile& p) {
    char b[256];
    std::string o;
    o += "WARZONE CONTROLLER SETTINGS - " + p.name + "\r\n";
    o += "Enter these in Warzone: Settings > Controller. Menu names can shift between\r\n";
    o += "seasons; match by meaning if a label differs.\r\n\r\n";
    o += "[Aiming]\r\n";
    std::snprintf(b, sizeof(b), "  Horizontal Stick Sensitivity ......... %d\r\n", p.sensH); o += b;
    std::snprintf(b, sizeof(b), "  Vertical Stick Sensitivity ........... %d\r\n", p.sensV); o += b;
    std::snprintf(b, sizeof(b), "  ADS Sensitivity Multiplier (low zoom)  %.2f\r\n", p.adsMult); o += b;
    std::snprintf(b, sizeof(b), "  ADS Sensitivity Multiplier (2x+ zoom)  %.2f\r\n", p.adsMultHigh); o += b;
    std::snprintf(b, sizeof(b), "  ADS Sensitivity Transition Timing .... %s\r\n", adsTransitionName(p.adsTransition)); o += b;
    std::snprintf(b, sizeof(b), "  Aim Response Curve Type .............. %s\r\n", curveName(p.curve)); o += b;
    o += "\r\n[Deadzone]\r\n";
    std::snprintf(b, sizeof(b), "  Left Stick Min / Max ................. %.2f / %.2f\r\n", p.lsMin, p.lsMax); o += b;
    std::snprintf(b, sizeof(b), "  Right Stick Min / Max ................ %.2f / %.2f\r\n", p.rsMin, p.rsMax); o += b;
    std::snprintf(b, sizeof(b), "  L2 / R2 Trigger Deadzone ............. %.2f / %.2f\r\n", p.ltDz, p.rtDz); o += b;
    o += "\r\n[Aim Assist]\r\n";
    std::snprintf(b, sizeof(b), "  Target Aim Assist .................... %s\r\n", p.aimAssist ? "On" : "Off"); o += b;
    std::snprintf(b, sizeof(b), "  Aim Assist Type (if offered) ......... %s\r\n", aimAssistTypeName(p.aimAssistType)); o += b;
    if (!p.notes.empty()) o += "\r\nNotes: " + p.notes + "\r\n";
    o += "\r\nThis sheet only lists values for the game's own settings menu. Nothing is\r\n";
    o += "written to the game, its files or its memory.\r\n";
    return o;
}

std::string ProfileStore::sanitizeName(const std::string& name) {
    std::string o;
    for (unsigned char c : name) {
        if (c < 32 || c == '<' || c == '>' || c == ':' || c == '"' || c == '/' || c == '\\' ||
            c == '|' || c == '?' || c == '*') o += '_';
        else o += (char)c;
    }
    while (!o.empty() && (o.back() == ' ' || o.back() == '.')) o.pop_back();
    while (!o.empty() && o.front() == ' ') o.erase(o.begin());
    if (o.empty()) o = "Unnamed";
    if (o.size() > 60) o.resize(60);
    return o;
}

std::string ProfileStore::pathFor(const std::string& name) const {
    return dir_ + "/" + sanitizeName(name) + ".wzprofile";
}

std::vector<std::string> ProfileStore::list() const {
    std::vector<std::string> out;
    std::error_code ec;
    for (auto it = std::filesystem::directory_iterator(std::filesystem::u8path(dir_), ec);
         !ec && it != std::filesystem::directory_iterator(); it.increment(ec)) {
        if (it->path().extension() == ".wzprofile") {
            std::string text;
            if (readFile(it->path().u8string(), text)) out.push_back(Profile::parse(text).name);
        }
    }
    std::sort(out.begin(), out.end());
    return out;
}

bool ProfileStore::exists(const std::string& name) const {
    std::error_code ec;
    return std::filesystem::exists(std::filesystem::u8path(pathFor(name)), ec);
}

bool ProfileStore::load(const std::string& name, Profile& out) const {
    std::string text;
    if (!readFile(pathFor(name), text)) return false;
    out = Profile::parse(text);
    return true;
}

bool ProfileStore::save(const Profile& p) const {
    std::error_code ec;
    std::filesystem::create_directories(std::filesystem::u8path(dir_), ec);
    return writeFile(pathFor(p.name), p.serialize());
}

bool ProfileStore::remove(const std::string& name) const {
    std::error_code ec;
    return std::filesystem::remove(std::filesystem::u8path(pathFor(name)), ec);
}

} // namespace wz
