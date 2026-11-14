// Deterministic RNG (xorshift64*), identical output on every compiler so that
// baseline and optimized benchmark runs face exactly the same target sequence.
#pragma once
#include <cstdint>

namespace wz {
class Rng {
public:
    explicit Rng(uint64_t seed = 1) : s_(seed ? seed : 0x9E3779B97F4A7C15ull) {
        for (int i = 0; i < 8; ++i) next();
    }
    uint64_t next() {
        s_ ^= s_ >> 12; s_ ^= s_ << 25; s_ ^= s_ >> 27;
        return s_ * 0x2545F4914F6CDD1Dull;
    }
    double uniform() { return (next() >> 11) * (1.0 / 9007199254740992.0); } // [0,1)
    double range(double lo, double hi) { return lo + (hi - lo) * uniform(); }
    bool chance(double p) { return uniform() < p; }
private:
    uint64_t s_;
};
} // namespace wz
