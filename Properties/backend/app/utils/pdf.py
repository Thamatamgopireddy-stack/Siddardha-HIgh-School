import os
from jinja2 import Environment, FileSystemLoader

HTML = None
try:
    from weasyprint import HTML
    weasyprint_available = True
except (ImportError, OSError):
    weasyprint_available = False

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))

def generate_pdf(template_name: str, context: dict) -> bytes:
    if not weasyprint_available or HTML is None:
        raise OSError("WeasyPrint GTK libraries are not available on this system.")
    
    template = env.get_template(template_name)
    html_content = template.render(context)
    pdf_bytes = HTML(string=html_content, base_url=TEMPLATES_DIR).write_pdf()
    if pdf_bytes is None:
        raise OSError("Failed to generate PDF")
    return pdf_bytes
