// Controller input: XInput source, a synthetic demo source, and a 1 kHz
// polling thread that timestamps samples independently of the render rate.
#pragma once
#include "../core/Types.h"

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace wz {

enum class DemoMode { Free, Rest, Release, Rotate, Triggers };

class IInputSource {
public:
    virtual ~IInputSource() = default;
    virtual PadState poll(double t) = 0;
    virtual std::string description() const = 0;
    virtual void setDemoMode(DemoMode) {}
    virtual bool isSimulated() const { return false; }
};

// Reads Xbox-compatible controllers through the XInput API (read-only).
std::unique_ptr<IInputSource> makeXInputSource();
// Synthetic controller for demonstrating / testing the UI without hardware.
std::unique_ptr<IInputSource> makeDemoSource();

class InputThread {
public:
    ~InputThread() { stop(); }
    void start(std::unique_ptr<IInputSource> src);
    void stop();

    PadState latest();
    // Moves all samples collected since the previous call into 'out'.
    void drain(std::vector<Sample>& out);
    double now() const;                 // seconds on the sample clock
    double pollHz() const { return pollHz_.load(); }     // how fast we poll
    double reportHz() const { return reportHz_.load(); } // how fast the pad reports (while moving)
    std::string description();
    bool simulated() const { return simulated_; }
    void setDemoMode(DemoMode m) { demoMode_.store((int)m); }

private:
    void loop();
    std::unique_ptr<IInputSource> src_;
    std::thread th_;
    std::atomic<bool> run_{false};
    std::mutex mu_;
    std::vector<Sample> buf_;
    PadState last_;
    std::string desc_;
    bool simulated_ = false;
    std::atomic<double> pollHz_{0.0}, reportHz_{0.0};
    std::atomic<int> demoMode_{0};
};

} // namespace wz
