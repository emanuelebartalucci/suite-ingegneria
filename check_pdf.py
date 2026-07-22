import sys
import os

pdf_path = r"c:\Users\e.bartalucci.INGEGNO.001\Documents\Antigravity\suite-ingegneria\File utili\Impianti Elettrici\Database\Canali Legrand.pdf"

print("Checking PDF existence:", os.path.exists(pdf_path))
if os.path.exists(pdf_path):
    print("File size:", os.path.getsize(pdf_path), "bytes")
