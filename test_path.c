#include <stdio.h>
#include <unistd.h>

int main() {
    char cwd[256];
    if (getcwd(cwd, sizeof(cwd)) != NULL) {
        printf("CWD: %s\n", cwd);
    }

    FILE *f = fopen("server/data/users.csv", "r");
    if (f) {
        printf("✓ File opened successfully\n");
        char line[256];
        int count = 0;
        while (fgets(line, sizeof(line), f) && count < 5) {
            printf("%s", line);
            count++;
        }
        fclose(f);
    } else {
        printf("✗ Failed to open server/data/users.csv\n");
    }
    return 0;
}
