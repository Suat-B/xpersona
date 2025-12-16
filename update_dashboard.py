
import os

file_path = 'dashboard.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = 'Browse Cars\n                    </a>'
replacement = 'Browse Cars\n                    </a>\n                    <a href="speed-reader.html" class="nav-item">\n                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>\n                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>\n                        </svg>\n                        Speed Reader\n                    </a>'

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated dashboard.html")
else:
    # Try with CRLF
    target_crlf = 'Browse Cars\r\n                    </a>'
    if target_crlf in content:
        new_content = content.replace(target_crlf, replacement) # Python writes \n as os.linesep
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully updated dashboard.html (CRLF match)")
    else:
        # Try looser match
        print("Could not find exact target string. Content snippet:")
        idx = content.find("Browse Cars")
        if idx != -1:
            print(repr(content[idx:idx+50]))
        else:
            print("Browse Cars not found")
