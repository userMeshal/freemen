// Localisation: English source strings are the keys; Arabic comes from a
// table. Lookups fall back to the English text, so a missing entry is never
// fatal. Portable (no Windows headers) so the core can produce translated
// recommendations and settings sheets.
#pragma once
#include <cstddef>
#include <string>
#include <vector>

namespace wz {

enum class Lang { English, Arabic };

void setLang(Lang l);
Lang lang();
inline bool isRtl() { return lang() == Lang::Arabic; }

// Translation of s in the current language, or s itself.
const char* tr(const char* s);
std::string trs(const std::string& s);

struct LangPair { const char* en; const char* ar; };
const LangPair* arabicTable(size_t& count);

// Development aid: collect strings that were looked up but have no Arabic entry.
void setMissingLog(bool on);
std::vector<std::string> missingStrings();

} // namespace wz
