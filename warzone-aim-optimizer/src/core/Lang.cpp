#include "Lang.h"

#include <set>
#include <string_view>
#include <unordered_map>

namespace wz {

namespace {
Lang g_lang = Lang::English;
bool g_logMissing = false;
std::set<std::string> g_missing;

const std::unordered_map<std::string_view, const char*>& table() {
    static const std::unordered_map<std::string_view, const char*> m = [] {
        std::unordered_map<std::string_view, const char*> t;
        size_t n = 0;
        const LangPair* p = arabicTable(n);
        t.reserve(n * 2);
        for (size_t i = 0; i < n; ++i) t.emplace(p[i].en, p[i].ar);
        return t;
    }();
    return m;
}

bool hasLatinLetters(std::string_view s) {
    int run = 0;
    for (char c : s) {
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) { if (++run >= 3) return true; }
        else run = 0;
    }
    return false;
}

const char* lookup(std::string_view s) {
    if (g_lang != Lang::Arabic || s.empty()) return nullptr;
    auto it = table().find(s);
    if (it != table().end()) return it->second;
    if (g_logMissing && hasLatinLetters(s)) g_missing.insert(std::string(s));
    return nullptr;
}
} // namespace

void setLang(Lang l) { g_lang = l; }
Lang lang() { return g_lang; }

const char* tr(const char* s) {
    if (!s) return "";
    const char* t = lookup(s);
    return t ? t : s;
}

std::string trs(const std::string& s) {
    const char* t = lookup(s);
    return t ? std::string(t) : s;
}

void setMissingLog(bool on) { g_logMissing = on; }
std::vector<std::string> missingStrings() { return std::vector<std::string>(g_missing.begin(), g_missing.end()); }

} // namespace wz
