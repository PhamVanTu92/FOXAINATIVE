#!/usr/bin/env python3
"""
Seed collections + sample documents vào index-service để test chatbot.

Usage:
  python3 scripts/seed-collections/seed.py --user admin --pass Admin@12345
  # hoặc
  USER=admin PASS=Admin@12345 python3 scripts/seed-collections/seed.py
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests

BASE = os.environ.get('API_BASE', 'http://localhost:3001')
HERE = Path(__file__).resolve().parent


# ─── Cấu hình collections cần seed ───────────────────────────────────────────
# Mỗi collection chứa danh sách file .txt từ thư mục cạnh script
COLLECTIONS = [
    {
        'name':        'ke_toan_noi_bo',
        'description': 'Tri thức Kế toán nội bộ FOXAI — quy trình, chính sách thuế',
        'files':       ['01_intro_ke_toan.txt', '02_chinh_sach_thue.txt'],
    },
    {
        'name':        'cskh_kinh_doanh',
        'description': 'Tri thức CSKH & Kinh doanh — sản phẩm, ưu đãi, đổi trả',
        'files':       ['03_san_pham_dich_vu.txt', '04_chinh_sach_doi_tra.txt'],
    },
]


def log(msg: str, indent: int = 0) -> None:
    prefix = '  ' * indent
    print(f'{prefix}{msg}', flush=True)


def login(username: str, password: str) -> str:
    log(f'→ Login as "{username}"')
    r = requests.post(
        f'{BASE}/api/auth/login',
        json={'username': username, 'password': password},
        timeout=15,
    )
    r.raise_for_status()
    token = r.json().get('accessToken')
    if not token:
        raise RuntimeError(f'No accessToken in login response: {r.json()}')
    log('✓ Got access token', 1)
    return token


def list_collections(token: str) -> list[dict[str, Any]]:
    r = requests.get(
        f'{BASE}/api/index/v1/collections/collections',
        headers={'Authorization': f'Bearer {token}'},
        timeout=15,
    )
    r.raise_for_status()
    body = r.json()
    # response envelope: { info: { data: { collections: [...] } } }
    cols = (
        body.get('info', {}).get('data', {}).get('collections')
        or body.get('data', {}).get('collections')
        or body.get('collections', [])
    )
    return cols or []


def create_collection(token: str, name: str, description: str) -> str:
    log(f'→ Create collection "{name}"')
    r = requests.post(
        f'{BASE}/api/index/v1/collections/collections',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type':  'application/json',
        },
        json={
            'collection_name':    name,
            'description':        description,
            'provider_embedding': 'gemini',
            'provider_storage':   'qdrant',
        },
        timeout=30,
    )
    if not r.ok:
        log(f'✗ Failed: HTTP {r.status_code} — {r.text[:300]}', 1)
        r.raise_for_status()
    body = r.json()
    # Response envelope shapes có thể là:
    #   { info: { collection_id: ... } }
    #   { info: { data: { id: ... } } }
    info = body.get('info', {})
    data = info.get('data') or info or body
    col_id = (
        info.get('collection_id')
        or data.get('id')
        or data.get('collection_id')
        or (data.get('collection') or {}).get('id')
    )
    if not col_id:
        raise RuntimeError(f'Cannot extract collection_id from response: {body}')
    log(f'✓ Created — id={col_id}', 1)
    return col_id


def upload_files(token: str, collection_id: str, files: list[Path]) -> list[str]:
    log(f'→ Upload {len(files)} file(s) to collection {collection_id}')
    files_payload = [
        ('files', (f.name, f.read_bytes(), 'text/plain'))
        for f in files
    ]
    r = requests.post(
        f'{BASE}/api/index/v1/collections/{collection_id}/documents/batch-upload',
        headers={'Authorization': f'Bearer {token}'},
        files=files_payload,
        timeout=60,
    )
    if not r.ok:
        log(f'✗ Failed: HTTP {r.status_code} — {r.text[:300]}', 1)
        r.raise_for_status()
    body = r.json()
    info = body.get('info', {})
    # Response shape: { info: { documents: [{ document_id, file_name, ... }] } }
    data = info.get('data') or info or body
    doc_ids: list[str] = []
    if isinstance(data, list):
        doc_ids = [d.get('id') or d.get('document_id') for d in data if isinstance(d, dict)]
    elif isinstance(data, dict):
        if 'document_ids' in data:
            doc_ids = list(data['document_ids'])
        elif 'documents' in data:
            doc_ids = [
                d.get('id') or d.get('document_id')
                for d in data['documents']
                if isinstance(d, dict)
            ]
    doc_ids = [x for x in doc_ids if x]
    if not doc_ids:
        raise RuntimeError(f'Cannot extract document IDs from upload response: {body}')
    for d in doc_ids:
        log(f'• doc {d}', 2)
    return doc_ids


def process_documents(token: str, collection_id: str, doc_ids: list[str]) -> None:
    log(f'→ Trigger processing for {len(doc_ids)} doc(s)')
    r = requests.post(
        f'{BASE}/api/index/v1/collections/{collection_id}/documents/batch-process',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type':  'application/json',
        },
        json={
            'document_ids':    doc_ids,
            'processing_type': 'document_structured_llm',
            'issuing_unit':    'FOXAI',
            'access_scope':    'internal',
            'version':         'v1',
        },
        timeout=30,
    )
    if not r.ok:
        log(f'✗ Failed: HTTP {r.status_code} — {r.text[:300]}', 1)
        r.raise_for_status()
    log('✓ Processing job queued', 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--user', default=os.environ.get('USER_LOGIN', os.environ.get('USER', '')))
    ap.add_argument('--pass', dest='password',
                    default=os.environ.get('PASS', os.environ.get('PASSWORD', '')))
    ap.add_argument('--skip-existing', action='store_true',
                    help='Bỏ qua collection đã tồn tại (theo tên)')
    args = ap.parse_args()

    if not args.user or not args.password:
        ap.error('Missing --user / --pass (hoặc env USER_LOGIN / PASS)')

    token = login(args.user, args.password)
    existing = {c.get('collection_name'): c for c in list_collections(token)}
    log(f'Existing collections: {list(existing.keys()) or "(none)"}')

    for spec in COLLECTIONS:
        name = spec['name']
        log('')
        log(f'━━━ Collection: {name} ━━━')

        if name in existing and args.skip_existing:
            col_id = existing[name].get('id')
            log(f'⚠ Skip — đã tồn tại (id={col_id})')
            continue

        if name in existing:
            col_id = existing[name].get('id')
            log(f'⚠ Đã tồn tại (id={col_id}) — sẽ thêm file vào collection hiện có')
        else:
            col_id = create_collection(token, name, spec['description'])

        files = [HERE / f for f in spec['files']]
        missing = [f for f in files if not f.exists()]
        if missing:
            log(f'✗ Thiếu file: {[str(m) for m in missing]}', 1)
            continue

        doc_ids = upload_files(token, col_id, files)
        process_documents(token, col_id, doc_ids)
        time.sleep(1)

    log('')
    log('━━━ DONE ━━━')
    log('Mở /he-thong/chatbot → "+ Thêm chatbot mới", section "Nguồn tri thức"')
    log('phải thấy các collection vừa seed trong dropdown.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except requests.HTTPError as e:
        print(f'\n✗ HTTP error: {e}', file=sys.stderr)
        if e.response is not None:
            print(f'   Response body: {e.response.text[:500]}', file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f'\n✗ Error: {e}', file=sys.stderr)
        sys.exit(1)
