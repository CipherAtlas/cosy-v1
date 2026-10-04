"""Lossless props-only subset; native rigs replace the old cow/sheep/owl geometry."""
import argparse
from split_puppies import ROOT, read_glb, subset


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    document, binary = read_glb(ROOT / 'public/village/models/farm-animals.glb')
    names = ['ForageApple', 'ForageMushroom', 'Hedgehog', 'OwlFeedingPerch']
    data = subset(document, binary, names)
    destination = ROOT / 'public/village/models/farm-props.glb'
    if args.check:
        assert destination.read_bytes() == data, 'Farm props differ from the original artwork'
    else:
        destination.write_bytes(data)
    result, packed = read_glb(destination)
    assert [result['nodes'][i]['name'] for i in result['scenes'][0]['nodes']] == names
    # Every retained buffer is copied byte for byte, including colors, UVs and indices.
    original = {binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in document['bufferViews']}
    for view in result['bufferViews']:
        offset = view.get('byteOffset', 0)
        assert packed[offset:offset + view['byteLength']] in original
    print(f'Farm props: {len(data):,} bytes; {len(binary):,} source bytes; all retained buffers identical')


if __name__ == '__main__':
    main()
