#pragma once
#include "Benchmark.h"
#include "Profile.h"
#include "StickAnalysis.h"

namespace wz {

struct Recommendation {
    Profile profile;
    std::vector<std::string> reasons;  // why each value was chosen
    std::vector<std::string> warnings; // hardware issues
    std::vector<std::string> tips;     // technique advice from the benchmark
};

// Builds an optimized settings profile from measured hardware data (cal),
// measured aiming data (bench) and the player's responsiveness/precision
// preference (current.bias). cal and bench may be null.
Recommendation recommend(const Profile& current, const CalibrationData* cal, const BenchResult* bench);

} // namespace wz
