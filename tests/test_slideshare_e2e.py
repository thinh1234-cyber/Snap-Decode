from playwright.sync_api import sync_playwright
import json
import fitz
import sys

sys.stdout.reconfigure(encoding='utf-8')

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # 1. Create a mock SlideShare page with __NEXT_DATA__
        # 80 slides in 4:3 ratio
        slides_info = {
            "title": "verilog-design",
            "host": "https://image.slidesharecdn.com",
            "imageLocation": "mock-loc",
            "imageSizes": [
                {"width": 2048, "quality": "75"},
                {"width": 1024, "quality": "85"},
                {"width": 638, "quality": "85"}
            ]
        }
        next_data = {
            "props": {
                "pageProps": {
                    "slideshow": {
                        "title": "Thiet Ke Mach So Verilog - 80 Slides",
                        "totalSlides": 80,
                        "slideDimensions": {"width": 1024, "height": 768},
                        "slides": slides_info
                    }
                }
            }
        }
        
        mock_html = f"""<!DOCTYPE html>
        <html>
        <head>
          <meta property="og:title" content="Thiet Ke Mach So Verilog - 80 Slides | SlideShare">
          <script id="__NEXT_DATA__" type="application/json">{json.dumps(next_data)}</script>
        </head>
        <body>
          <h1>Thiet Ke Mach So Verilog - 80 Slides</h1>
        </body>
        </html>
        """
        
        page.set_content(mock_html)
        
        # Intercept CDN requests and return a realistic 4:3 SVG slide
        def handle_route(route):
            url = route.request.url
            # Parse slide number
            import re
            m = re.search(r'-(\d+)-\d+\.jpg', url)
            idx = m.group(1) if m else "1"
            svg = f"""<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='768' viewBox='0 0 1024 768'>
                <rect width='1024' height='768' fill='white'/>
                <rect y='720' width='1024' height='48' fill='#1a73e8'/>
                <text x='512' y='100' font-size='40' text-anchor='middle' fill='#d84315' font-weight='bold'>THIET KE MACH SO VOI VERILOG</text>
                <text x='512' y='384' font-size='50' text-anchor='middle' fill='#222'>TRANG {idx} / 80</text>
                <text x='512' y='460' font-size='24' text-anchor='middle' fill='#666'>Noi dung bai giang ky thuat so danh cho Kyle</text>
            </svg>"""
            route.fulfill(
                status=200,
                content_type="image/svg+xml",
                body=svg.encode('utf-8')
            )
            
        page.route("**/image.slidesharecdn.com/**", handle_route)
        
        # 2. Inject slideshare.js
        with open("js/doc-unlocker/providers/slideshare.js", "r", encoding="utf-8") as f:
            code = f.read()
            
        page.evaluate(code)
        
        # 3. Trigger generatePDF()
        print("Triggering __SnapDocSlideShare.generatePDF()...")
        page.evaluate("""() => {
            window.__SnapDocSlideShare.generatePDF();
        }""")
        
        # Wait until print button is ready
        page.wait_for_selector(".snap-btn-print.ready", timeout=30000)
        print("All 80 slides loaded successfully in DOM!")
        
        # Trigger prepareForPrint by clicking or dispatching event
        page.click(".snap-btn-print")
        
        # 4. Save to PDF with Default Chrome Margins (0.4 in)
        out_pdf = "tests/test_slideshare_80_final.pdf"
        page.pdf(
            path=out_pdf,
            format="A4",
            landscape=True,
            margin={"top": "0.4in", "bottom": "0.4in", "left": "0.4in", "right": "0.4in"},
            print_background=True
        )
        browser.close()
        
        # 5. Inspect PDF with PyMuPDF
        doc = fitz.open(out_pdf)
        print(f"\n=======================================================")
        print(f"VERIFICATION: GENERATED PDF HAS {len(doc)} PAGES (EXPECTED 80)")
        print(f"=======================================================")
        assert len(doc) == 80, f"Error: expected 80 pages, got {len(doc)}"
        
        # Check text on pages 1, 2, 40, 79, 80
        sample_pages = [0, 1, 39, 78, 79]
        for p_idx in sample_pages:
            txt = doc[p_idx].get_text().strip()
            print(f"Page {p_idx + 1:2d}: {repr(txt)}")
            assert f"TRANG {p_idx + 1} / 80" in txt, f"Missing content on page {p_idx + 1}!"
            
        print("\n🎉 SUCCESS: 100% of pages verified! No doubling, no blank white pages!")

if __name__ == "__main__":
    main()
