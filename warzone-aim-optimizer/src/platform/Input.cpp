#include "Input.h"
#include "../core/Rng.h"
#include "../core/StickAnalysis.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <mmsystem.h>

#include <chrono>
#include <deque>

namespace wz {

namespace {

// Minimal XInput declarations so the DLL can be loaded at runtime (works with
// xinput1_4 on Windows 8+ and falls back to older versions).
struct XGamepad { WORD wButtons; BYTE bLeftTrigger, bRightTrigger; SHORT sThumbLX, sThumbLY, sThumbRX, sThumbRY; };
struct XState { DWORD dwPacketNumber; XGamepad Gamepad; };
typedef DWORD(WINAPI* XInputGetStateFn)(DWORD, XState*);

double axis(SHORT v) { return clampd((double)v / 32767.0, -1.0, 1.0); }

class XInputSource : public IInputSource {
public:
    XInputSource() {
        const wchar_t* dlls[] = {L"xinput1_4.dll", L"xinput1_3.dll", L"xinput9_1_0.dll"};
        for (const wchar_t* d : dlls) {
            dll_ = LoadLibraryW(d);
            if (!dll_) continue;
            get_ = (XInputGetStateFn)(void*)GetProcAddress(dll_, "XInputGetState");
            if (get_) { char n[32]; WideCharToMultiByte(CP_UTF8, 0, d, -1, n, sizeof(n), nullptr, nullptr); dllName_ = n; break; }
            FreeLibrary(dll_); dll_ = nullptr;
        }
    }
    ~XInputSource() override { if (dll_) FreeLibrary(dll_); }

    PadState poll(double t) override {
        PadState p;
        if (!get_) return p;
        // Stay on the connected slot; rescan the other slots only twice a
        // second because polling empty XInput slots is slow.
        if (slot_ >= 0 && read(slot_, p)) return p;
        slot_ = -1;
        if (t - lastScan_ < 0.5) return p;
        lastScan_ = t;
        for (int i = 0; i < 4; ++i) if (read(i, p)) { slot_ = i; return p; }
        return p;
    }
    std::string description() const override {
        return get_ ? "XInput (" + dllName_ + ")" : "XInput not available";
    }

private:
    bool read(int slot, PadState& p) {
        XState s{};
        if (get_((DWORD)slot, &s) != ERROR_SUCCESS) return false;
        p.connected = true; p.slot = slot; p.packet = s.dwPacketNumber;
        p.ls = {axis(s.Gamepad.sThumbLX), axis(s.Gamepad.sThumbLY)};
        p.rs = {axis(s.Gamepad.sThumbRX), axis(s.Gamepad.sThumbRY)};
        p.lt = s.Gamepad.bLeftTrigger / 255.0; p.rt = s.Gamepad.bRightTrigger / 255.0;
        p.buttons = s.Gamepad.wButtons;
        return true;
    }
    HMODULE dll_ = nullptr;
    XInputGetStateFn get_ = nullptr;
    std::string dllName_;
    int slot_ = -1;
    double lastScan_ = -1.0;
};

// Emulates a slightly worn pad reporting at 125 Hz: small centre offset,
// sensor noise, imperfect re-centring. Used only with the --demo flag.
class DemoSource : public IInputSource {
public:
    void setDemoMode(DemoMode m) override { if (m != mode_) { mode_ = m; modeStart_ = -1; } }
    bool isSimulated() const override { return true; }
    std::string description() const override { return "Simulated controller (demo mode)"; }

    PadState poll(double t) override {
        if (modeStart_ < 0) modeStart_ = t;
        if (t - lastReport_ < 0.008) return state_;
        lastReport_ = t;
        double u = t - modeStart_;
        PadState p; p.connected = true; p.slot = 0;
        Vec2 offR(0.031, -0.018), offL(-0.008, 0.012);
        Vec2 r, l;
        switch (mode_) {
            case DemoMode::Rest: break;
            case DemoMode::Release: {
                double ph = std::fmod(u, 1.2); int k = (int)(u / 1.2);
                if (ph < 0.35) { double a = k * 2.4; r = {std::cos(a) * 0.97, std::sin(a) * 0.97}; l = {std::cos(a + 1) * 0.97, std::sin(a + 1) * 0.97}; }
                else { r = {0.012 * std::sin(k * 1.7), 0.015 * std::cos(k * 2.3)}; l = {0.006 * std::cos(k * 1.3), 0.004 * std::sin(k * 0.9)}; }
                break;
            }
            case DemoMode::Rotate: {
                double a = u * 2.6;
                double rr = 0.99 - 0.05 * std::max(0.0, std::cos(a - 2.2)); // one weaker direction
                r = {std::cos(a) * rr, std::sin(a) * rr}; l = {std::cos(-a) * 1.0, std::sin(-a) * 1.0};
                break;
            }
            case DemoMode::Triggers: {
                double v = std::fmod(u, 1.4) < 0.7 ? 1.0 : 0.0;
                p.lt = v; p.rt = v;
                break;
            }
            case DemoMode::Free:
            default: {
                r = {0.75 * std::sin(u * 1.3) * std::cos(u * 0.31), 0.55 * std::sin(u * 0.9 + 1.0) * std::sin(u * 0.23)};
                l = {0.9 * std::sin(u * 0.7), 0.4 * std::cos(u * 0.5)};
                p.rt = std::fmod(u, 0.9) < 0.12 ? 1.0 : 0.0;
                p.lt = std::fmod(u, 6.0) > 3.0 ? 1.0 : 0.0;
                if (std::fmod(u, 4.0) < 0.3) p.buttons |= BtnX;
                break;
            }
        }
        auto n = [&] { return rng_.range(-0.004, 0.004); };
        p.rs = {clampd(r.x + offR.x + n(), -1, 1), clampd(r.y + offR.y + n(), -1, 1)};
        p.ls = {clampd(l.x + offL.x + n(), -1, 1), clampd(l.y + offL.y + n(), -1, 1)};
        p.lt = clampd(p.lt + 0.012, 0.0, 1.0);
        p.packet = ++packet_;
        state_ = p;
        return p;
    }

private:
    DemoMode mode_ = DemoMode::Free;
    double modeStart_ = -1, lastReport_ = -1;
    uint32_t packet_ = 0;
    PadState state_;
    Rng rng_{4242};
};

} // namespace

std::unique_ptr<IInputSource> makeXInputSource() { return std::make_unique<XInputSource>(); }
std::unique_ptr<IInputSource> makeDemoSource() { return std::make_unique<DemoSource>(); }

static const std::chrono::steady_clock::time_point g_epoch = std::chrono::steady_clock::now();

double InputThread::now() const {
    return std::chrono::duration<double>(std::chrono::steady_clock::now() - g_epoch).count();
}

void InputThread::start(std::unique_ptr<IInputSource> src) {
    stop();
    src_ = std::move(src);
    desc_ = src_->description();
    simulated_ = src_->isSimulated();
    run_ = true;
    th_ = std::thread([this] { loop(); });
}

void InputThread::stop() {
    run_ = false;
    if (th_.joinable()) th_.join();
}

PadState InputThread::latest() {
    std::lock_guard<std::mutex> g(mu_);
    return last_;
}

std::string InputThread::description() {
    std::lock_guard<std::mutex> g(mu_);
    return desc_;
}

void InputThread::drain(std::vector<Sample>& out) {
    std::lock_guard<std::mutex> g(mu_);
    out.insert(out.end(), buf_.begin(), buf_.end());
    buf_.clear();
}

void InputThread::loop() {
    // A high-resolution waitable timer gives ~1 ms periods on Windows 10
    // 1803+. Older systems fall back to Sleep(1) at 1 ms timer resolution.
    HANDLE timer = CreateWaitableTimerExW(nullptr, nullptr, 0x00000002 /*HIGH_RESOLUTION*/, TIMER_ALL_ACCESS);
    if (!timer) timeBeginPeriod(1);
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);

    std::deque<double> packetTimes;
    uint32_t lastPacket = 0; bool havePacket = false;
    double rateT0 = now(); int rateN = 0;
    int lastMode = -1;

    while (run_) {
        double t = now();
        int mode = demoMode_.load();
        if (mode != lastMode) { src_->setDemoMode((DemoMode)mode); lastMode = mode; }
        PadState p = src_->poll(t);

        if (p.connected) {
            if (havePacket && p.packet != lastPacket) {
                packetTimes.push_back(t);
                while (packetTimes.size() > 400) packetTimes.pop_front();
            }
            lastPacket = p.packet; havePacket = true;
        } else {
            havePacket = false; packetTimes.clear();
        }
        // Drop stale packet times so the estimate reflects recent movement.
        while (!packetTimes.empty() && t - packetTimes.front() > 3.0) packetTimes.pop_front();

        {
            std::lock_guard<std::mutex> g(mu_);
            last_ = p;
            if (buf_.size() < 20000) buf_.push_back({t, p});
        }

        if (++rateN >= 250) {
            double t1 = now();
            if (t1 > rateT0) pollHz_ = rateN / (t1 - rateT0);
            rateT0 = t1; rateN = 0;
            reportHz_ = estimateReportHz(std::vector<double>(packetTimes.begin(), packetTimes.end()));
        }

        if (timer) {
            LARGE_INTEGER due; due.QuadPart = -10000; // 1 ms in 100 ns units
            if (SetWaitableTimer(timer, &due, 0, nullptr, nullptr, FALSE)) WaitForSingleObject(timer, 20);
            else Sleep(1);
        } else {
            Sleep(1);
        }
    }
    if (timer) CloseHandle(timer);
    else timeEndPeriod(1);
}

} // namespace wz
