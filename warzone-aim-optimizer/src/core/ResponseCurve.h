#pragma once
#include "Types.h"

namespace wz {

enum class CurveType { Standard = 0, Linear = 1, Dynamic = 2 };

const char* curveName(CurveType c);

// Maps normalized stick deflection (0..1, after deadzone) to normalized turn
// rate (0..1). These are approximations of the published curve shapes, used
// for visualization and for the built-in trainer - not the game's own code.
double applyCurve(CurveType c, double x);

struct StickTuning {
    double dzMin = 0.05;
    double dzMax = 0.99;
    CurveType curve = CurveType::Standard;
};

// Rescales r so dzMin -> 0 and dzMax -> 1.
double applyDeadzone(double r, double dzMin, double dzMax);

// Radial deadzone + response curve applied to the stick magnitude.
Vec2 processStick(Vec2 raw, const StickTuning& t);

double processTrigger(double v, double deadzone);

} // namespace wz
