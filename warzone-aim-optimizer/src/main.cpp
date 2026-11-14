// Warzone Aim Assist Optimizer - Win32 entry point, window and render loop.
#include "ui/App.h"

#include <mmsystem.h>
#include <shellapi.h>
#include <shlobj.h>
#include <windowsx.h>

#include <chrono>

using namespace wz;

namespace {

App g_app;
Ui g_ui;
HWND g_hwnd = nullptr;
float g_scale = 1.0f;
bool g_fullscreen = false;
WINDOWPLACEMENT g_prevPlacement{};

struct BackBuffer {
    HDC dc = nullptr; HBITMAP bmp = nullptr; HBITMAP old = nullptr; int w = 0, h = 0;
    void ensure(HDC ref, int nw, int nh) {
        if (dc && nw == w && nh == h) return;
        release();
        dc = CreateCompatibleDC(ref);
        BITMAPINFO bi{};
        bi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        bi.bmiHeader.biWidth = nw; bi.bmiHeader.biHeight = -nh;
        bi.bmiHeader.biPlanes = 1; bi.bmiHeader.biBitCount = 32; bi.bmiHeader.biCompression = BI_RGB;
        void* bits = nullptr;
        bmp = CreateDIBSection(ref, &bi, DIB_RGB_COLORS, &bits, nullptr, 0);
        old = (HBITMAP)SelectObject(dc, bmp);
        w = nw; h = nh;
    }
    void release() {
        if (dc) { SelectObject(dc, old); DeleteObject(bmp); DeleteDC(dc); dc = nullptr; bmp = nullptr; }
    }
} g_back;

UINT dpiForWindow(HWND hwnd) {
    // GetDpiForWindow exists on Windows 10 1607+; resolve it dynamically.
    typedef UINT(WINAPI* Fn)(HWND);
    static Fn fn = (Fn)(void*)GetProcAddress(GetModuleHandleW(L"user32.dll"), "GetDpiForWindow");
    if (fn) { UINT d = fn(hwnd); if (d) return d; }
    HDC dc = GetDC(hwnd);
    UINT d = (UINT)GetDeviceCaps(dc, LOGPIXELSX);
    ReleaseDC(hwnd, dc);
    return d ? d : 96;
}

void toggleFullscreen() {
    DWORD style = (DWORD)GetWindowLongPtrW(g_hwnd, GWL_STYLE);
    if (!g_fullscreen) {
        MONITORINFO mi{};
        mi.cbSize = sizeof(mi);
        g_prevPlacement.length = sizeof(g_prevPlacement);
        if (GetWindowPlacement(g_hwnd, &g_prevPlacement) && GetMonitorInfoW(MonitorFromWindow(g_hwnd, MONITOR_DEFAULTTOPRIMARY), &mi)) {
            SetWindowLongPtrW(g_hwnd, GWL_STYLE, style & ~WS_OVERLAPPEDWINDOW);
            SetWindowPos(g_hwnd, HWND_TOP, mi.rcMonitor.left, mi.rcMonitor.top, mi.rcMonitor.right - mi.rcMonitor.left,
                         mi.rcMonitor.bottom - mi.rcMonitor.top, SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
            g_fullscreen = true;
        }
    } else {
        SetWindowLongPtrW(g_hwnd, GWL_STYLE, style | WS_OVERLAPPEDWINDOW);
        SetWindowPlacement(g_hwnd, &g_prevPlacement);
        SetWindowPos(g_hwnd, nullptr, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
        g_fullscreen = false;
    }
}

void renderFrame() {
    RECT rc;
    GetClientRect(g_hwnd, &rc);
    int w = rc.right - rc.left, h = rc.bottom - rc.top;
    if (w <= 0 || h <= 0) return;
    HDC wdc = GetDC(g_hwnd);
    g_back.ensure(wdc, w, h);
    {
        Gdiplus::Graphics g(g_back.dc);
        g.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
        g.SetTextRenderingHint(Gdiplus::TextRenderingHintAntiAliasGridFit);
        g.SetPixelOffsetMode(Gdiplus::PixelOffsetModeHalf);
        g.ScaleTransform(g_scale, g_scale);
        g_ui.beginFrame(&g, g_app.now);
        drawApp(g_app, g_ui, w / g_scale, h / g_scale);
        g_ui.endFrame();
    }
    BitBlt(wdc, 0, 0, w, h, g_back.dc, 0, 0, SRCCOPY);
    ReleaseDC(g_hwnd, wdc);
}

LRESULT CALLBACK wndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
        case WM_MOUSEMOVE:
            g_ui.mouse = PointF(GET_X_LPARAM(lp) / g_scale, GET_Y_LPARAM(lp) / g_scale);
            return 0;
        case WM_LBUTTONDOWN:
            g_ui.mouse = PointF(GET_X_LPARAM(lp) / g_scale, GET_Y_LPARAM(lp) / g_scale);
            g_ui.down = true; g_ui.pressed = true;
            SetCapture(hwnd);
            return 0;
        case WM_LBUTTONUP:
            g_ui.mouse = PointF(GET_X_LPARAM(lp) / g_scale, GET_Y_LPARAM(lp) / g_scale);
            g_ui.down = false; g_ui.released = true;
            ReleaseCapture();
            return 0;
        case WM_CHAR:
            if (wp == 8) g_ui.keyBack = true;
            else if (wp == 13) g_ui.keyEnter = true;
            else if (wp >= 32) g_ui.typed += (wchar_t)wp;
            return 0;
        case WM_KEYDOWN:
            if (wp == VK_ESCAPE) g_ui.keyEsc = true;
            if (wp == VK_F11) toggleFullscreen();
            return 0;
        case WM_GETMINMAXINFO: {
            MINMAXINFO* mm = (MINMAXINFO*)lp;
            mm->ptMinTrackSize.x = (LONG)(1180 * g_scale);
            mm->ptMinTrackSize.y = (LONG)(760 * g_scale);
            return 0;
        }
        case WM_DPICHANGED: {
            g_scale = HIWORD(wp) / 96.0f;
            RECT* r = (RECT*)lp;
            SetWindowPos(hwnd, nullptr, r->left, r->top, r->right - r->left, r->bottom - r->top, SWP_NOZORDER | SWP_NOACTIVATE);
            return 0;
        }
        case WM_SIZE:
        case WM_PAINT:
            if (msg == WM_PAINT) ValidateRect(hwnd, nullptr);
            if (g_app.now > 0) renderFrame(); // keep drawing during modal resize
            return 0;
        case WM_ERASEBKGND:
            return 1;
        case WM_CLOSE:
            DestroyWindow(hwnd);
            return 0;
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

std::string dataDirectory(const std::wstring& overrideDir) {
    if (!overrideDir.empty()) return narrow(overrideDir);
    wchar_t path[MAX_PATH] = L"";
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_APPDATA | CSIDL_FLAG_CREATE, nullptr, 0, path)))
        return narrow(path) + "/WarzoneAimOptimizer";
    return "WarzoneAimOptimizerData";
}

} // namespace

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR, int show) {
    bool demo = false;
    std::wstring dataOverride;
    int startPage = 0;
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    for (int i = 1; argv && i < argc; ++i) {
        std::wstring a = argv[i];
        if (a == L"--demo") demo = true;
        else if (a == L"--data" && i + 1 < argc) dataOverride = argv[++i];
        else if (a == L"--page" && i + 1 < argc) startPage = _wtoi(argv[++i]);
    }
    if (argv) LocalFree(argv);

    // One instance per data directory is enough; focus the existing window.
    HANDLE mutex = CreateMutexW(nullptr, TRUE, demo ? L"WarzoneAimOptimizer.Demo" : L"WarzoneAimOptimizer.Main");
    if (mutex && GetLastError() == ERROR_ALREADY_EXISTS && dataOverride.empty()) {
        HWND other = FindWindowW(L"WzAimOptimizerWnd", nullptr);
        if (other) { ShowWindow(other, SW_RESTORE); SetForegroundWindow(other); }
        return 0;
    }

    Gdiplus::GdiplusStartupInput gsi;
    ULONG_PTR gdipToken = 0;
    if (Gdiplus::GdiplusStartup(&gdipToken, &gsi, nullptr) != Gdiplus::Ok) {
        MessageBoxW(nullptr, L"GDI+ could not be initialised.", L"Warzone Aim Assist Optimizer", MB_ICONERROR);
        return 1;
    }
    timeBeginPeriod(1);

    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = wndProc;
    wc.hInstance = inst;
    wc.hCursor = LoadCursorW(nullptr, (LPCWSTR)IDC_ARROW);
    wc.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(1));
    wc.hIconSm = wc.hIcon;
    wc.lpszClassName = L"WzAimOptimizerWnd";
    RegisterClassExW(&wc);

    g_hwnd = CreateWindowExW(0, wc.lpszClassName, demo ? L"Warzone Aim Assist Optimizer (demo mode)" : L"Warzone Aim Assist Optimizer",
                             WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, 1380, 900, nullptr, nullptr, inst, nullptr);
    if (!g_hwnd) return 1;
    g_scale = dpiForWindow(g_hwnd) / 96.0f;
    if (g_scale > 1.01f) {
        RECT wa;
        SystemParametersInfoW(SPI_GETWORKAREA, 0, &wa, 0);
        int w = std::min((int)(1380 * g_scale), (int)(wa.right - wa.left)), h = std::min((int)(900 * g_scale), (int)(wa.bottom - wa.top));
        SetWindowPos(g_hwnd, nullptr, wa.left + (wa.right - wa.left - w) / 2, wa.top + (wa.bottom - wa.top - h) / 2, w, h, SWP_NOZORDER);
    }

    g_app.init(dataDirectory(dataOverride), demo);
    if (startPage > 0 && startPage < (int)Page::Count) g_app.page = (Page)startPage;
    g_app.update();
    ShowWindow(g_hwnd, show);
    UpdateWindow(g_hwnd);

    using clock = std::chrono::steady_clock;
    bool running = true;
    while (running) {
        auto frameStart = clock::now();
        MSG msg;
        while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) { running = false; break; }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        if (!running) break;
        if (IsIconic(g_hwnd)) {
            g_app.update(); // keep draining input so buffers stay small
            Sleep(50);
            continue;
        }
        g_app.update();
        renderFrame();
        // The arena renders as fast as ~240 fps; ordinary pages idle at ~100 fps.
        double target = g_app.fullscreenArena() ? 1.0 / 240.0 : 1.0 / 100.0;
        while (std::chrono::duration<double>(clock::now() - frameStart).count() < target) Sleep(1);
    }

    g_app.saveSettings();
    g_app.input.stop();
    g_back.release();
    timeEndPeriod(1);
    Gdiplus::GdiplusShutdown(gdipToken);
    if (mutex) CloseHandle(mutex);
    return 0;
}
