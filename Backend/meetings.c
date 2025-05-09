#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <sys/stat.h>

#define MAX_ATTENDEES 100
#define MAX_NAME_LEN 50
#define MAX_AGENDA_LEN 200
#define MAX_OUTCOME_LEN 300
#define CSV_FILE_PATH "../server/data/meeting_records.csv"

typedef struct {
    char date[11]; // YYYY-MM-DD
    char time[6];  // HH:MM
    char title[100];
    char agenda[MAX_AGENDA_LEN];
    char location[100];
    int num_attendees;
    char attendees[MAX_ATTENDEES][MAX_NAME_LEN];
    char outcome[MAX_OUTCOME_LEN];
} Meeting;

Meeting meetings[100];
int meetingCount = 0;

void createDirectoryIfNotExists(const char *path) {
    struct stat st = {0};
    if (stat(path, &st) == -1) {
        mkdir(path);
    }
}

void escapeJsonString(const char *input, FILE *output) {
    while (*input) {
        switch (*input) {
            case '"': fputs("\\\"", output); break;
            case '\\': fputs("\\\\", output); break;
            case '\b': fputs("\\b", output); break;
            case '\f': fputs("\\f", output); break;
            case '\n': fputs("\\n", output); break;
            case '\r': fputs("\\r", output); break;
            case '\t': fputs("\\t", output); break;
            default: fputc(*input, output);
        }
        input++;
    }
}

void printSuccess(const char *message) {
    printf("{\"status\":\"success\",\"message\":\"%s\"}\n", message);
}

void printError(const char *message) {
    fprintf(stderr, "{\"status\":\"error\",\"message\":\"%s\"}\n", message);
}

void loadMeetings() {
    createDirectoryIfNotExists("../server");
    createDirectoryIfNotExists("../server/data");
    
    FILE *file = fopen(CSV_FILE_PATH, "r");
    if (!file) {
        file = fopen(CSV_FILE_PATH, "w");
        if (file) {
            fprintf(file, "date,time,title,agenda,location,num_attendees,attendees,outcome\n");
            fclose(file);
        }
        return;
    }

    char line[1024];
    if (!fgets(line, sizeof(line), file)) { // Skip header
        fclose(file);
        return;
    }

    while (fgets(line, sizeof(line), file)) {
        line[strcspn(line, "\n")] = 0;
        
        char *token = strtok(line, ",");
        if (!token) continue;
        strncpy(meetings[meetingCount].date, token, 10);

        token = strtok(NULL, ",");
        if (!token) continue;
        strncpy(meetings[meetingCount].time, token, 5);

        token = strtok(NULL, ",");
        if (!token) continue;
        strncpy(meetings[meetingCount].title, token, 99);

        token = strtok(NULL, ",");
        if (!token) continue;
        strncpy(meetings[meetingCount].agenda, token, MAX_AGENDA_LEN-1);

        token = strtok(NULL, ",");
        if (!token) continue;
        strncpy(meetings[meetingCount].location, token, 99);

        token = strtok(NULL, ",");
        if (!token) continue;
        meetings[meetingCount].num_attendees = atoi(token);

        token = strtok(NULL, ",");
        if (!token) continue;
        char *attendee = strtok(token, "|");
        int i = 0;
        while (attendee && i < MAX_ATTENDEES) {
            strncpy(meetings[meetingCount].attendees[i], attendee, MAX_NAME_LEN-1);
            attendee = strtok(NULL, "|");
            i++;
        }
        meetings[meetingCount].num_attendees = i;

        token = strtok(NULL, "\n");
        if (token) {
            strncpy(meetings[meetingCount].outcome, token, MAX_OUTCOME_LEN-1);
        }
        
        meetingCount++;
        if (meetingCount >= 100) break;
    }
    fclose(file);
}

void saveMeetings() {
    FILE *file = fopen(CSV_FILE_PATH, "w");
    if (!file) {
        printError("Failed to open data file for writing");
        return;
    }

    fprintf(file, "date,time,title,agenda,location,num_attendees,attendees,outcome\n");
    for (int i = 0; i < meetingCount; i++) {
        fprintf(file, "%s,%s,%s,%s,%s,%d,",
                meetings[i].date,
                meetings[i].time,
                meetings[i].title,
                meetings[i].agenda,
                meetings[i].location,
                meetings[i].num_attendees);

        for (int j = 0; j < meetings[i].num_attendees; j++) {
            fprintf(file, "%s", meetings[i].attendees[j]);
            if (j != meetings[i].num_attendees - 1) {
                fprintf(file, "|");
            }
        }
        fprintf(file, ",%s\n", meetings[i].outcome);
    }
    fclose(file);
}

void listMeetings() {
    printf("[");
    for (int i = 0; i < meetingCount; i++) {
        if (i > 0) printf(",");
        printf("{\"id\":%d,\"date\":\"%s\",\"time\":\"%s\",\"title\":\"", i+1, meetings[i].date, meetings[i].time);
        escapeJsonString(meetings[i].title, stdout);
        printf("\",\"agenda\":\"");
        escapeJsonString(meetings[i].agenda, stdout);
        printf("\",\"location\":\"");
        escapeJsonString(meetings[i].location, stdout);
        printf("\",\"attendees\":[");
        for (int j = 0; j < meetings[i].num_attendees; j++) {
            if (j > 0) printf(",");
            printf("\"");
            escapeJsonString(meetings[i].attendees[j], stdout);
            printf("\"");
        }
        printf("],\"outcome\":\"");
        escapeJsonString(meetings[i].outcome, stdout);
        printf("\"}");
    }
    printf("]\n");
}

void addMeeting(const char* date, const char* time, const char* title, const char* agenda, 
                const char* location, const char* attendees, const char* outcome) {
    if (meetingCount >= 100) {
        printError("Maximum meetings reached");
        return;
    }

    strncpy(meetings[meetingCount].date, date, 10);
    strncpy(meetings[meetingCount].time, time, 5);
    strncpy(meetings[meetingCount].title, title, 99);
    strncpy(meetings[meetingCount].agenda, agenda, MAX_AGENDA_LEN-1);
    strncpy(meetings[meetingCount].location, location, 99);
    strncpy(meetings[meetingCount].outcome, outcome, MAX_OUTCOME_LEN-1);

    // Process attendees
    char tempAttendees[1024];
    strncpy(tempAttendees, attendees, sizeof(tempAttendees));
    char *attendee = strtok(tempAttendees, ",");
    int i = 0;
    while (attendee && i < MAX_ATTENDEES) {
        strncpy(meetings[meetingCount].attendees[i], attendee, MAX_NAME_LEN-1);
        attendee = strtok(NULL, ",");
        i++;
    }
    meetings[meetingCount].num_attendees = i;

    meetingCount++;
    saveMeetings();
    printSuccess("Meeting added successfully");
}

void deleteMeeting(int id) {
    if (id < 1 || id > meetingCount) {
        printError("Invalid meeting ID");
        return;
    }

    for (int i = id-1; i < meetingCount-1; i++) {
        meetings[i] = meetings[i+1];
    }
    meetingCount--;
    saveMeetings();
    printSuccess("Meeting deleted successfully");
}

void searchMeetings(const char* type, const char* query) {
    printf("[");
    int count = 0;
    
    for (int i = 0; i < meetingCount; i++) {
        bool match = false;
        
        if (strcmp(type, "date") == 0) {
            match = strstr(meetings[i].date, query) != NULL;
        } else if (strcmp(type, "agenda") == 0) {
            match = strstr(meetings[i].agenda, query) != NULL;
        } else if (strcmp(type, "attendee") == 0) {
            for (int j = 0; j < meetings[i].num_attendees; j++) {
                if (strstr(meetings[i].attendees[j], query) != NULL) {
                    match = true;
                    break;
                }
            }
        } else if (strcmp(type, "outcome") == 0) {
            match = strstr(meetings[i].outcome, query) != NULL;
        }
        
        if (match) {
            if (count++ > 0) printf(",");
            printf("{\"id\":%d,\"date\":\"%s\",\"time\":\"%s\",\"title\":\"", i+1, meetings[i].date, meetings[i].time);
            escapeJsonString(meetings[i].title, stdout);
            printf("\",\"agenda\":\"");
            escapeJsonString(meetings[i].agenda, stdout);
            printf("\",\"location\":\"");
            escapeJsonString(meetings[i].location, stdout);
            printf("\",\"attendees\":[");
            for (int j = 0; j < meetings[i].num_attendees; j++) {
                if (j > 0) printf(",");
                printf("\"");
                escapeJsonString(meetings[i].attendees[j], stdout);
                printf("\"");
            }
            printf("],\"outcome\":\"");
            escapeJsonString(meetings[i].outcome, stdout);
            printf("\"}");
        }
    }
    printf("]\n");
}

int main(int argc, char *argv[]) {
    loadMeetings();
    
    if (argc < 2) {
        listMeetings();
        return 0;
    }
    
    if (strcmp(argv[1], "add") == 0 && argc == 9) {
        addMeeting(argv[2], argv[3], argv[4], argv[5], argv[6], argv[7], argv[8]);
    } 
    else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        deleteMeeting(atoi(argv[2]));
    }
    else if (strcmp(argv[1], "search") == 0 && argc == 4) {
        searchMeetings(argv[2], argv[3]);
    }
    else if (strcmp(argv[1], "list") == 0) {
        listMeetings();
    }
    else {
        printError("Invalid command");
    }
    
    return 0;
}