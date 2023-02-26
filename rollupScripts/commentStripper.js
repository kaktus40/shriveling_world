export function commentStripper(contents) {
    let newContents = [];
    for (let i = 0; i < contents.length; ++i) {
        let c = contents.charAt(i);
        if (c === '/') {
            c = contents.charAt(++i);
            if (c === '/') {
                while (c !== '\r' && c !== '\n' && i < contents.length) {
                    c = contents.charAt(++i);
                }
            } else if (c === '*') {
                while (i < contents.length) {
                    c = contents.charAt(++i);
                    if (c === '*') {
                        c = contents.charAt(++i);
                        while (c === '*') {
                            c = contents.charAt(++i);
                        }
                        if (c === '/') {
                            c = contents.charAt(++i);
                            break;
                        }
                    }
                }
            } else {
                --i;
                c = '/';
            }
        }
        newContents.push(c);
    }

    newContents = newContents.join('');
    newContents = newContents.replace(/\s+$/gm, '').replace(/^\s+/gm, '').replace(/\n+/gm, '\n');
    return newContents;
}