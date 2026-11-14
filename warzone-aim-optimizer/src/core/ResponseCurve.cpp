#include "ResponseCurve.h"

namespace wz {

const char* curveName(CurveType c) {
    switch (c) {
        case CurveType::Standard: return "Standard";
        case CurveType::Linear:   return "Linear";
        case CurveType::Dynamic:  return "Dynamic";
    }
    return "Standard";
}

double applyCurve(CurveType c, double x) {
    x = clampd(x, 0.0, 1.0);
    switch (c) {
        case CurveType::Linear:
            return x;
        case CurveType::Dynamic: {
            // Reverse S-curve: quick initial response, flatter mid-range for
            // fine rate control, quick ramp to full speed at the edge.
            double u = 2.0 * x - 1.0;
            double s = (u < 0 ? -1.0 : 1.0) * std::pow(std::fabs(u), 1.7);
            double rs = 0.5 * (1.0 + s);
            return 0.45 * x + 0.55 * rs;
        }
        case CurveType::Standard:
        default:
            // Simple power curve: fine control near centre, fast at the edge.
            return std::pow(x, 2.0);
    }
}

double applyDeadzone(double r, double dzMin, double dzMax) {
    if (dzMax <= dzMin + 1e-6) dzMax = dzMin + 1e-6;
    if (r <= dzMin) return 0.0;
    if (r >= dzMax) return 1.0;
    return (r - dzMin) / (dzMax - dzMin);
}

Vec2 processStick(Vec2 raw, const StickTuning& t) {
    double r = raw.len();
    if (r < 1e-9) return {};
    double m = applyCurve(t.curve, applyDeadzone(r, t.dzMin, t.dzMax));
    return {raw.x / r * m, raw.y / r * m};
}

double processTrigger(double v, double deadzone) {
    deadzone = clampd(deadzone, 0.0, 0.95);
    if (v <= deadzone) return 0.0;
    return clampd((v - deadzone) / (1.0 - deadzone), 0.0, 1.0);
}

} // namespace wz
