#include <stdio.h>
#include <string.h>

unsigned int simple_hash(const char *str) {
    unsigned int hash = 0;
    while (*str) {
        hash ^= (unsigned int)(*str);
        hash = (hash << 1) | (hash >> 31);
        str++;
    }
    return hash;
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: %s <password>\n", argv[0]);
        return 1;
    }
    printf("%u\n", simple_hash(argv[1]));
    return 0;
}
