// Small immediate-mode UI toolkit drawn with GDI+. All coordinates are in
// device-independent pixels; a scale transform handles the monitor DPI.
#pragma once
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <objidl.h>
#include <algorithm>
namespace Gdiplus { using std::min; using std::max; }
#include <gdiplus.h>

#include "../core/Lang.h"

#include <map>
#include <memory>
#include <string>
#include <vector>

namespace wz {

using Gdiplus::Color;
using Gdiplus::PointF;
using Gdiplus::RectF;

namespace theme {
const Color bg(255, 14, 16, 20);
const Color side(255, 20, 23, 29);
const Color card(255, 27, 31, 39);
const Color cardHi(255, 37, 42, 53);
const Color border(255, 49, 55, 68);
const Color text(255, 233, 237, 243);
const Color dim(255, 157, 166, 181);
const Color faint(255, 98, 107, 124);
const Color accent(255, 255, 140, 40);
const Color accentHi(255, 255, 166, 84);
const Color blue(255, 84, 170, 255);
const Color good(255, 72, 208, 138);
const Color warn(255, 250, 200, 70);
const Color bad(255, 240, 92, 92);
}

enum class Align { Left, Center, Right };
enum class Btn { Primary, Secondary, Danger };

std::wstring widen(const std::string& s);
std::string narrow(const std::wstring& s);
std::string fmt(const char* f, ...);
Color withAlpha(Color c, int a);

class Ui {
public:
    Gdiplus::Graphics* g = nullptr;

    // Right-to-left layout: when the language is RTL every primitive is
    // mirrored horizontally, so page code keeps using ordinary "logical"
    // coordinates. Things with a physical orientation (stick scopes, graphs,
    // the training arena) are drawn inside beginLtr()/endLtr(), which moves
    // the region to its mirrored position but keeps its contents unflipped.
    bool rtl = false;
    float viewW = 0;
    void beginLtr(const RectF& region);
    void endLtr();
    // Checks on the live GDI+ whether Arabic shaping / bidi behave as the UI
    // relies on. Used by --selfcheck. Returns a human-readable report.
    std::string textSelfCheck(bool& allOk);

    // Per-frame input, in dp. mousePhys is the real pointer position; mouse
    // is the same point in logical (possibly mirrored) coordinates.
    PointF mousePhys{-1, -1};
    PointF mouse{-1, -1};
    bool down = false, pressed = false, released = false;
    std::wstring typed;
    bool keyBack = false, keyEnter = false, keyEsc = false;
    double time = 0;
    std::string activeId, focusId;

    void beginFrame(Gdiplus::Graphics* gfx, double t, float viewWidth);
    void endFrame();

    bool hover(const RectF& r) const { return r.Contains(mouse); }

    void fill(const RectF& r, Color c);
    void fillRound(const RectF& r, float rad, Color c);
    void strokeRound(const RectF& r, float rad, Color c, float w = 1.0f);
    void line(float x1, float y1, float x2, float y2, Color c, float w = 1.0f);
    void circle(float cx, float cy, float r, Color c);
    void ring(float cx, float cy, float r, Color c, float w = 1.0f);
    void polyline(const std::vector<PointF>& pts, Color c, float w = 1.5f, bool closed = false);

    void text(const std::string& s, const RectF& r, float size, Color c, Align a = Align::Left, bool bold = false);
    // Word-wrapped, top-aligned. Returns the height used.
    float textWrap(const std::string& s, const RectF& r, float size, Color c, bool bold = false);
    float textWidth(const std::string& s, float size, bool bold = false);
    float wrapHeight(const std::string& s, float width, float size, bool bold = false);

    void card(const RectF& r, const std::string& title = "");
    void progress(const RectF& r, double frac, Color c);
    void pill(const std::string& s, float x, float y, Color bgc, Color fg);

    bool button(const std::string& label, const RectF& r, Btn style = Btn::Primary, bool enabled = true);
    bool slider(const std::string& id, const RectF& r, double& v, double mn, double mx, double step);
    bool segmented(const std::string& id, const RectF& r, const std::vector<std::string>& opts, int& idx);
    bool textField(const std::string& id, const RectF& r, std::string& value, size_t maxLen = 40);
    // Clickable list row; returns true when clicked.
    bool row(const RectF& r, bool selected);

private:
    Gdiplus::Font* font(float size, bool bold);
    float mapX(float x, float w) const;
    RectF mapRect(const RectF& r) const { return RectF(mapX(r.X, r.Width), r.Y, r.Width, r.Height); }
    bool rtlFlagHonored();
    Gdiplus::StringAlignment hAlign(Align logical, bool rtlParagraph);
    bool ltr_ = false;
    float ltrShift_ = 0;
    int rtlHonored_ = -1;
    // Measured single-line widths, so text that does not fit its box can be
    // scaled down instead of being cut off (translations vary in length).
    float cachedWidth(const std::wstring& w, float size, bool bold);
    std::map<std::wstring, float> widthCache_;
    std::map<int, std::unique_ptr<Gdiplus::Font>> fonts_;
    std::unique_ptr<Gdiplus::FontFamily> family_;
};

} // namespace wz
