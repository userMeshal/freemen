// Shared plain-data types. Portable C++17: no Windows headers in src/core.
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace wz {

constexpr double kPi = 3.14159265358979323846;

struct Vec2 {
    double x = 0.0, y = 0.0;
    Vec2() = default;
    Vec2(double x_, double y_) : x(x_), y(y_) {}
    Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
    Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
    Vec2 operator*(double s) const { return {x * s, y * s}; }
    double len() const { return std::sqrt(x * x + y * y); }
};

inline double clampd(double v, double lo, double hi) { return v < lo ? lo : (v > hi ? hi : v); }
inline double lerpd(double a, double b, double t) { return a + (b - a) * t; }

// Same bit layout as XINPUT_GAMEPAD.wButtons.
enum Button : uint16_t {
    BtnDPadUp = 0x0001, BtnDPadDown = 0x0002, BtnDPadLeft = 0x0004, BtnDPadRight = 0x0008,
    BtnStart = 0x0010, BtnBack = 0x0020, BtnLThumb = 0x0040, BtnRThumb = 0x0080,
    BtnLB = 0x0100, BtnRB = 0x0200, BtnA = 0x1000, BtnB = 0x2000, BtnX = 0x4000, BtnY = 0x8000
};

struct PadState {
    bool connected = false;
    int slot = -1;
    Vec2 ls, rs;            // normalized -1..1, +Y is up
    double lt = 0.0, rt = 0.0; // normalized 0..1
    uint16_t buttons = 0;
    uint32_t packet = 0;
};

struct Sample {
    double t = 0.0; // seconds, monotonic
    PadState pad;
};

struct TimedVec {
    double t = 0.0;
    Vec2 v;
};

double median(std::vector<double> v);
double mean(const std::vector<double>& v);
double stddev(const std::vector<double>& v);
double percentile(std::vector<double> v, double p); // p in 0..1

} // namespace wz
