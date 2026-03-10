#!/usr/bin/env python3
"""
Split each landscape PDF page into two portrait pages (left half, then right half).

Usage:
  python3 split_landscape_pdf.py input.pdf output.pdf
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pypdf import PageObject, PdfReader, PdfWriter, Transformation


def split_landscape_pages(input_pdf: Path, output_pdf: Path) -> tuple[int, int, int]:
    reader = PdfReader(str(input_pdf))
    writer = PdfWriter()

    input_pages = 0
    split_pages = 0
    output_pages = 0

    for page in reader.pages:
        input_pages += 1

        # Normalize rotation so width/height represent visual orientation.
        page.transfer_rotation_to_content()

        width = float(page.mediabox.width)
        height = float(page.mediabox.height)

        if width > height:
            split_pages += 1
            half = width / 2.0

            left = PageObject.create_blank_page(width=half, height=height)
            left.merge_transformed_page(
                page,
                Transformation().translate(tx=-float(page.mediabox.left), ty=-float(page.mediabox.bottom)),
            )
            writer.add_page(left)

            right = PageObject.create_blank_page(width=half, height=height)
            right.merge_transformed_page(
                page,
                Transformation().translate(
                    tx=-(float(page.mediabox.left) + half),
                    ty=-float(page.mediabox.bottom),
                ),
            )
            writer.add_page(right)
            output_pages += 2
        else:
            writer.add_page(page)
            output_pages += 1

    if reader.metadata:
        writer.add_metadata({k: str(v) for k, v in reader.metadata.items() if v is not None})

    with output_pdf.open("wb") as f:
        writer.write(f)

    return input_pages, split_pages, output_pages


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Split each landscape PDF page into left/right portrait pages."
    )
    parser.add_argument("input_pdf", type=Path, help="Source PDF")
    parser.add_argument("output_pdf", type=Path, help="Output PDF")
    args = parser.parse_args()

    if not args.input_pdf.exists():
        print(f"Error: input file not found: {args.input_pdf}", file=sys.stderr)
        return 1

    if args.input_pdf.resolve() == args.output_pdf.resolve():
        print("Error: output path must be different from input path.", file=sys.stderr)
        return 1

    input_pages, split_pages, output_pages = split_landscape_pages(args.input_pdf, args.output_pdf)
    print("Done.")
    print(f"Input pages: {input_pages}")
    print(f"Landscape pages split: {split_pages}")
    print(f"Output pages: {output_pages}")
    print(f"Saved to: {args.output_pdf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
