#include "KeyValue.h"

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <sstream>

namespace wz {

static std::string escape(const std::string& s) {
    std::string o;
    for (char c : s) {
        if (c == '\n') o += "\\n";
        else if (c == '\r') continue;
        else if (c == '\\') o += "\\\\";
        else o += c;
    }
    return o;
}

static std::string unescape(const std::string& s) {
    std::string o;
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '\\' && i + 1 < s.size()) {
            ++i;
            o += (s[i] == 'n') ? '\n' : s[i];
        } else o += s[i];
    }
    return o;
}

void KeyValue::setNum(const std::string& k, double v) {
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%.6g", v);
    m_[k] = buf;
}

std::string KeyValue::get(const std::string& k, const std::string& def) const {
    auto it = m_.find(k);
    return it == m_.end() ? def : it->second;
}

double KeyValue::getNum(const std::string& k, double def) const {
    auto it = m_.find(k);
    if (it == m_.end() || it->second.empty()) return def;
    char* end = nullptr;
    double v = std::strtod(it->second.c_str(), &end);
    return end == it->second.c_str() ? def : v;
}

long long KeyValue::getInt(const std::string& k, long long def) const {
    auto it = m_.find(k);
    if (it == m_.end() || it->second.empty()) return def;
    char* end = nullptr;
    long long v = std::strtoll(it->second.c_str(), &end, 10);
    return end == it->second.c_str() ? def : v;
}

std::string KeyValue::serialize() const {
    std::string o;
    for (const auto& kv : m_) o += kv.first + "=" + escape(kv.second) + "\n";
    return o;
}

static void parseLine(const std::string& line, KeyValue& kv) {
    if (line.empty() || line[0] == '#') return;
    size_t eq = line.find('=');
    if (eq == std::string::npos) return;
    kv.set(line.substr(0, eq), unescape(line.substr(eq + 1)));
}

KeyValue KeyValue::parse(const std::string& text) {
    KeyValue kv;
    std::istringstream in(text);
    std::string line;
    while (std::getline(in, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        parseLine(line, kv);
    }
    return kv;
}

std::vector<KeyValue> KeyValue::parseRecords(const std::string& text) {
    std::vector<KeyValue> out;
    std::istringstream in(text);
    std::string line;
    bool open = false;
    while (std::getline(in, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line == "[record]") { out.emplace_back(); open = true; continue; }
        if (open) parseLine(line, out.back());
    }
    return out;
}

std::string KeyValue::serializeRecords(const std::vector<KeyValue>& recs) {
    std::string o;
    for (const auto& r : recs) o += "[record]\n" + r.serialize() + "\n";
    return o;
}

bool readFile(const std::string& path, std::string& out) {
    std::ifstream f(std::filesystem::u8path(path), std::ios::binary);
    if (!f) return false;
    std::ostringstream ss;
    ss << f.rdbuf();
    out = ss.str();
    return true;
}

bool writeFile(const std::string& path, const std::string& data) {
    // Write to a temp file then rename, so a crash never leaves a half-written file.
    auto target = std::filesystem::u8path(path);
    auto tmp = std::filesystem::u8path(path + ".tmp");
    {
        std::ofstream f(tmp, std::ios::binary | std::ios::trunc);
        if (!f) return false;
        f.write(data.data(), static_cast<std::streamsize>(data.size()));
        if (!f) return false;
    }
    std::error_code ec;
    std::filesystem::rename(tmp, target, ec);
    if (ec) {
        std::filesystem::remove(target, ec);
        std::filesystem::rename(tmp, target, ec);
    }
    return !ec;
}

} // namespace wz
