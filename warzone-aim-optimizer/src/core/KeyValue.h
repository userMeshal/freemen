// Minimal "key=value" text store with optional [section] records.
#pragma once
#include <map>
#include <string>
#include <vector>

namespace wz {

class KeyValue {
public:
    void set(const std::string& k, const std::string& v) { m_[k] = v; }
    void setNum(const std::string& k, double v);
    void setInt(const std::string& k, long long v) { m_[k] = std::to_string(v); }
    bool has(const std::string& k) const { return m_.count(k) != 0; }
    std::string get(const std::string& k, const std::string& def = "") const;
    double getNum(const std::string& k, double def = 0.0) const;
    long long getInt(const std::string& k, long long def = 0) const;

    std::string serialize() const;
    static KeyValue parse(const std::string& text);
    // Splits a file made of "[record]" headed blocks.
    static std::vector<KeyValue> parseRecords(const std::string& text);
    static std::string serializeRecords(const std::vector<KeyValue>& recs);

private:
    std::map<std::string, std::string> m_;
};

bool readFile(const std::string& path, std::string& out);
bool writeFile(const std::string& path, const std::string& data);

} // namespace wz
