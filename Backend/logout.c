#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define SESSIONS_FILE "sessions.csv"
#define HISTORY_FILE "history.csv"

// Get the current time in the format yyyy-mm-dd hh:mm:ss
void get_current_time(char *buffer, size_t size) {
    time_t now = time(NULL);
    struct tm *t = localtime(&now);
    strftime(buffer, size, "%Y-%m-%d %H:%M:%S", t);
}

// Clear a user's session
void clear_session(const char *username) {
    FILE *temp = fopen("temp.csv", "w");
    FILE *file = fopen(SESSIONS_FILE, "r");
    if (!file || !temp) return;

    char line[256], u[50], t[50];
    while (fgets(line, sizeof(line), file)) {
        if (sscanf(line, "%[^,],%[^\n]", u, t) == 2) {
            if (strcmp(u, username) != 0) {
                fprintf(temp, "%s,%s\n", u, t);
            }
        }
    }

    fclose(file);
    fclose(temp);
    remove(SESSIONS_FILE);
    rename("temp.csv", SESSIONS_FILE);
}

// Write login and logout history
void write_history(const char *username, const char *login_time, const char *logout_time) {
    struct tm tm_login = {0}, tm_logout = {0};

    sscanf(login_time, "%d-%d-%d %d:%d:%d",
           &tm_login.tm_year, &tm_login.tm_mon, &tm_login.tm_mday,
           &tm_login.tm_hour, &tm_login.tm_min, &tm_login.tm_sec);
    tm_login.tm_year -= 1900;
    tm_login.tm_mon -= 1;

    sscanf(logout_time, "%d-%d-%d %d:%d:%d",
           &tm_logout.tm_year, &tm_logout.tm_mon, &tm_logout.tm_mday,
           &tm_logout.tm_hour, &tm_logout.tm_min, &tm_logout.tm_sec);
    tm_logout.tm_year -= 1900;
    tm_logout.tm_mon -= 1;

    time_t t1 = mktime(&tm_login);
    time_t t2 = mktime(&tm_logout);
    double duration = difftime(t2, t1);

    FILE *file = fopen(HISTORY_FILE, "a");
    if (file) {
        fprintf(file, "%s,%s,%s,%.0f\n", username, login_time, logout_time, duration);
        fclose(file);
    }
}

void logout() {
    char username[50];

    printf("\nUsername to logout: ");
    fgets(username, sizeof(username), stdin);
    username[strcspn(username, "\n")] = 0;

    FILE *file = fopen(SESSIONS_FILE, "r");
    if (!file) {
        printf("\nNo session found.\n");
        return;
    }

    char line[256], u[50], login_time[50];
    int found = 0;
    while (fgets(line, sizeof(line), file)) {
        if (sscanf(line, "%[^,],%[^\n]", u, login_time) == 2) {
            if (strcmp(u, username) == 0) {
                found = 1;
                break;
            }
        }
    }
    fclose(file);

    if (found) {
        char logout_time[50];
        get_current_time(logout_time, sizeof(logout_time));
        write_history(username, login_time, logout_time);
        clear_session(username);
        printf("\nLogout successful at %s\n", logout_time);
    } else {
        printf("\nUser not logged in.\n");
    }
}

int main() {
    logout();
    return 0;
}