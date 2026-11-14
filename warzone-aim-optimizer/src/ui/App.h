#pragma once
#include "../core/Benchmark.h"
#include "../core/History.h"
#include "../core/Profile.h"
#include "../core/Recommender.h"
#include "../core/StickAnalysis.h"
#include "../platform/Input.h"
#include "Ui.h"

#include <deque>
#include <memory>

namespace wz {

enum class Page { Dashboard = 0, Live, Calibration, Profiles, Benchmark, Results, Count };

struct CalState {
    int step = 0; // 0 intro, 1 rest, 2 release, 3 rotate, 4 triggers, 5 results
    double stepStart = 0;
    std::string message;
    std::vector<Vec2> restL, restR, rotL, rotR;
    std::vector<TimedVec> relL, relR;
    std::vector<double> trigL, trigR;
    RangeResult liveL, liveR;
    int settlesL = 0, settlesR = 0;
    double lastLive = 0;
    double reportHz = 0;
};

struct BenchUi {
    std::unique_ptr<BenchmarkSession> session;
    bool running = false;
    int labelIdx = 0; // 0 Baseline, 1 Optimized, 2 Practice
    int modeIdx = 0;  // 0 Full, 1 Quick
    double lastT = 0;
    bool haveResult = false;
    RunRecord last;
    uint16_t prevButtons = 0;
    double pilotSeen = 0;
    bool pilotHad = false;
    double assist = 0.0;   // trainer aim-assist strength chosen for the next run
};

struct ProfUi {
    std::string nameEdit;
    std::vector<std::string> names;
    bool listDirty = true;
    bool haveRec = false;
    Recommendation rec;
    std::string recSource;
};

struct App {
    InputThread input;
    bool demo = false;
    std::string dataDir;
    ProfileStore store;
    HistoryStore history;

    Profile profile;        // the active profile being edited / used by the trainer
    CalibrationData cal;
    std::string baselineId;

    Page page = Page::Dashboard;
    double now = 0;
    PadState pad;
    std::vector<Sample> frame;   // samples collected since the previous frame
    std::deque<Sample> recent;   // last few seconds, for graphs

    CalState calSt;
    BenchUi bench;
    ProfUi prof;
    std::string selectedRun;

    std::string toast;
    double toastUntil = 0;
    bool quit = false;
    bool langForced = false;  // language fixed from the command line
    bool titleDirty = false;  // window title needs refreshing after a language change

    void init(const std::string& dir, bool demoMode);
    void update();
    void saveSettings();
    void notify(const std::string& msg);
    void setProfile(const Profile& p);
    void go(Page p);

    const RunRecord* baseline() const;
    const RunRecord* latestRun(bool excludeBaseline) const;
    bool fullscreenArena() const { return page == Page::Benchmark && bench.running; }
};

std::string timestampNow(bool forId);
void openInShell(const std::string& path);

void drawApp(App& app, Ui& ui, float w, float h);
void pageDashboard(App& app, Ui& ui, const RectF& area);
void pageLive(App& app, Ui& ui, const RectF& area);
void pageCalibration(App& app, Ui& ui, const RectF& area);
void pageProfiles(App& app, Ui& ui, const RectF& area);
void pageBenchmark(App& app, Ui& ui, const RectF& area);
void pageResults(App& app, Ui& ui, const RectF& area);

// Shared widgets
void pageHeader(Ui& ui, const RectF& a, const std::string& title, const std::string& sub);
struct ScopeOpts {
    double dzMin = 0, dzMax = 1;
    bool showProcessed = false;
    Vec2 processed;
    const std::vector<Vec2>* trail = nullptr;
    const double* bins = nullptr;      // kAngleBins edge radii (calibration)
    const std::vector<Vec2>* marks = nullptr; // settle points
};
void drawScope(Ui& ui, const RectF& r, Vec2 raw, const ScopeOpts& o);
void drawGoalBar(Ui& ui, const RectF& r, double ratio);
Color pctColor(double pct);

} // namespace wz
