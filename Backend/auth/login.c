#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <errno.h>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

#define USERS_FILE "C:/Users/HP/OneDrive/Desktop/Yashwanth/ceebros-gardens/server/data/users.csv"
#define SESSIONS_FILE "C:/Users/HP/OneDrive/Desktop/Yashwanth/ceebros-gardens/server/data/sessions.csv"

unsigned int simple_hash(const char *str) {
    unsigned int hash = 0;
    while (*str) {
        hash ^= (unsigned int)(*str);
        hash = (hash << 1) | (hash >> 31);
        str++;
    }
    return hash;
}

void get_current_time(char *buffer, size_t size) {
    time_t now = time(NULL);
    struct tm *t = localtime(&now);
    strftime(buffer, size, "%Y-%m-%d %H:%M:%S", t);
}

int read_user_hash(const char *username, unsigned int *stored_hash) {
    FILE *file = fopen(USERS_FILE, "r");
    if (!file) {
        return 0;
    }

    char line[256], u[50];
    unsigned int h;
    while (fgets(line, sizeof(line), file)) {
        if (sscanf(line, "%[^,],%u", u, &h) == 2) {
            if (strcmp(username, u) == 0) {
                *stored_hash = h;
                fclose(file);
                return 1;
            }
        }
    }

    fclose(file);
    return 0;
}

void write_session_file(const char *username, const char *time) {
    FILE *file = fopen(SESSIONS_FILE, "a");
    if (file) {
        fprintf(file, "%s,%s\n", username, time);
        fclose(file);
    }
}

int main(int argc, char *argv[]) {
    // Set stdout to binary mode on Windows to prevent newline conversion
    #ifdef _WIN32
    _setmode(_fileno(stdout), _O_BINARY);
    #endif

    if (argc < 3) {
        const char *error_json = "{\"status\":\"error\",\"message\":\"Usage: %s username password\"}";
        printf(error_json, argv[0]);
        return 1;
    }

    char *username = argv[1];
    char *password = argv[2];
    unsigned int stored_hash;

    unsigned int input_hash = simple_hash(password);
    
    if (read_user_hash(username, &stored_hash)) {
        if (input_hash == stored_hash) {
            char time_now[50];
            get_current_time(time_now, sizeof(time_now));
            write_session_file(username, time_now);
            
            // Determine role
            const char *role = "member";
            if (strcmp(username, "secretary") == 0) role = "secretary";
            else if (strcmp(username, "president") == 0) role = "president";
            else if (strcmp(username, "vice president") == 0) role = "vice_president";
            else if (strcmp(username, "admin") == 0) role = "admin";
            
            // Single clean JSON output
            printf("{\"status\":\"success\",\"role\":\"%s\",\"message\":\"Welcome, %s!\"}", 
                  role, username);
        } else {
            printf("{\"status\":\"error\",\"message\":\"Invalid password\"}");
        }
    } else {
        printf("{\"status\":\"error\",\"message\":\"User not found\"}");
    }
    
    return 0;
}