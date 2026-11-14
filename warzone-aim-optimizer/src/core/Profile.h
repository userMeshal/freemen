#pragma once
#include "ResponseCurve.h"
#include <string>
#include <vector>

namespace wz {

// A Warzone controller settings profile. Field names mirror the in-game
// Controller settings menu; values are entered in the game by the player.
struct Profile {
    std::string name = "Default";
    std::string notes;

    int sensH = 6;                 // Horizontal Stick Sensitivity (1..20)
    int sensV = 6;                 // Vertical Stick Sensitivity (1..20)
    double adsMult = 1.00;         // ADS Sensitivity Multiplier, low zoom
    double adsMultHigh = 1.00;     // ADS Sensitivity Multiplier, 2x+ zoom
    int adsTransition = 0;         // 0 Instant, 1 Gradual, 2 After Zoom
    CurveType curve = CurveType::Standard; // Aim Response Curve Type

    double lsMin = 0.05, lsMax = 0.99; // Left Stick Min / Max deadzone
    double rsMin = 0.05, rsMax = 0.99; // Right Stick Min / Max deadzone
    double ltDz = 0.00, rtDz = 0.00;   // L2 / R2 trigger deadzone

    bool aimAssist = true;         // Target Aim Assist
    int aimAssistType = 0;         // 0 Default, 1 Precision, 2 Focusing, 3 Black Ops

    double bias = 0.0;             // -1 precision .. +1 responsiveness (recommender input)
    double trainerFov = 110.0;     // horizontal FOV used by the built-in trainer

    StickTuning rightTuning() const { return {rsMin, rsMax, curve}; }
    StickTuning leftTuning() const { return {lsMin, lsMax, CurveType::Linear}; }

    void sanitize();
    std::string serialize() const;
    static Profile parse(const std::string& text);
};

const char* adsTransitionName(int v);
const char* aimAssistTypeName(int v);

std::vector<Profile> builtinPresets();

// Plain-text sheet listing every value to enter in the Warzone settings menu.
std::string exportCheatSheet(const Profile& p);

class ProfileStore {
public:
    explicit ProfileStore(std::string dir = "") : dir_(std::move(dir)) {}
    void setDir(const std::string& d) { dir_ = d; }
    std::vector<std::string> list() const;      // sorted profile names
    bool load(const std::string& name, Profile& out) const;
    bool save(const Profile& p) const;
    bool remove(const std::string& name) const;
    bool exists(const std::string& name) const;
    std::string pathFor(const std::string& name) const;
    static std::string sanitizeName(const std::string& name);
private:
    std::string dir_;
};

} // namespace wz
