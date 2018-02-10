

export function compareBuffers(buffer1,buffer2):boolean {
    let l1 = buffer1.length, l2 = buffer2.length;
    if (l1 != l2) return false;
    for (var i=0; i<Math.min(l1,l2); i++) {
        var byte1 = buffer1[i], byte2 = buffer2[i];
        if (byte1 != byte2) return false;
    }
    return true;
}