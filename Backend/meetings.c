// Meetings module: a growable array (realloc-based vector), replacing the
// old fixed meetings[100] cap. Stateless per-request compute engine — stdin
// carries the current rows as CSV (id,date,time,title,agenda,location,
// attendees[pipe-joined],outcome — no header line), one operation runs, and
// {"result": ..., "state": [...]} is printed to stdout.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define MAX_ATTENDEES 100
#define MAX_NAME_LEN 50
#define MAX_FIELD_LEN 512

typedef struct {
    int id;
    char date[11];
    char time[6];
    char title[100];
    char agenda[MAX_FIELD_LEN];
    char location[100];
    int numAttendees;
    char attendees[MAX_ATTENDEES][MAX_NAME_LEN];
    char outcome[MAX_FIELD_LEN];
} Meeting;

Meeting* meetings = NULL;
int meetingCount = 0;
int meetingCapacity = 0;

void ensureCapacity() {
    if (meetingCount < meetingCapacity) return;
    meetingCapacity = meetingCapacity == 0 ? 8 : meetingCapacity * 2;
    meetings = realloc(meetings, meetingCapacity * sizeof(Meeting));
}

void escapeJsonString(const char* input, FILE* output) {
    while (*input) {
        switch (*input) {
            case '"': fputs("\\\"", output); break;
            case '\\': fputs("\\\\", output); break;
            case '\n': fputs("\\n", output); break;
            case '\r': fputs("\\r", output); break;
            case '\t': fputs("\\t", output); break;
            default: fputc(*input, output);
        }
        input++;
    }
}

void printMeetingJson(Meeting* m) {
    printf("{\"id\":%d,\"date\":\"%s\",\"time\":\"%s\",\"title\":\"", m->id, m->date, m->time);
    escapeJsonString(m->title, stdout);
    printf("\",\"agenda\":\"");
    escapeJsonString(m->agenda, stdout);
    printf("\",\"location\":\"");
    escapeJsonString(m->location, stdout);
    printf("\",\"attendees\":[");
    for (int j = 0; j < m->numAttendees; j++) {
        if (j > 0) printf(",");
        printf("\"");
        escapeJsonString(m->attendees[j], stdout);
        printf("\"");
    }
    printf("],\"outcome\":\"");
    escapeJsonString(m->outcome, stdout);
    printf("\"}");
}

void printAllJson() {
    printf("[");
    for (int i = 0; i < meetingCount; i++) {
        if (i > 0) printf(",");
        printMeetingJson(&meetings[i]);
    }
    printf("]");
}

// Splits on the next literal comma (never skips empty fields, unlike strtok)
// and strips one pair of surrounding quotes if present. Mutates the buffer.
char* nextField(char** cursor) {
    if (!*cursor) return "";
    char* start = *cursor;
    char* comma = strchr(start, ',');
    if (comma) { *comma = '\0'; *cursor = comma + 1; }
    else { *cursor = NULL; }
    size_t len = strlen(start);
    if (len >= 2 && start[0] == '"' && start[len - 1] == '"') {
        start[len - 1] = '\0';
        start++;
    }
    return start;
}

// Reads stdin CSV: id,"date","time","title","agenda","location","attendee1|attendee2|...","outcome"
void loadFromStdin() {
    char line[2048];
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\n")] = 0;
        if (line[0] == '\0') continue;

        ensureCapacity();
        Meeting* m = &meetings[meetingCount];
        memset(m, 0, sizeof(Meeting));

        char* cursor = line;
        m->id = atoi(nextField(&cursor));
        strncpy(m->date, nextField(&cursor), sizeof(m->date) - 1);
        strncpy(m->time, nextField(&cursor), sizeof(m->time) - 1);
        strncpy(m->title, nextField(&cursor), sizeof(m->title) - 1);
        strncpy(m->agenda, nextField(&cursor), sizeof(m->agenda) - 1);
        strncpy(m->location, nextField(&cursor), sizeof(m->location) - 1);

        char attendeesBuf[1024];
        strncpy(attendeesBuf, nextField(&cursor), sizeof(attendeesBuf) - 1);
        attendeesBuf[sizeof(attendeesBuf) - 1] = '\0';
        if (attendeesBuf[0] != '\0') {
            char* attendee = strtok(attendeesBuf, "|");
            int i = 0;
            while (attendee && i < MAX_ATTENDEES) {
                strncpy(m->attendees[i], attendee, MAX_NAME_LEN - 1);
                attendee = strtok(NULL, "|");
                i++;
            }
            m->numAttendees = i;
        }

        strncpy(m->outcome, nextField(&cursor), sizeof(m->outcome) - 1);

        meetingCount++;
    }
}

void addMeeting(int id, const char* date, const char* time, const char* title, const char* agenda,
                const char* location, const char* attendeesCsv, const char* outcome) {
    ensureCapacity();
    Meeting* m = &meetings[meetingCount];
    memset(m, 0, sizeof(Meeting));
    m->id = id;
    strncpy(m->date, date, sizeof(m->date) - 1);
    strncpy(m->time, time, sizeof(m->time) - 1);
    strncpy(m->title, title, sizeof(m->title) - 1);
    strncpy(m->agenda, agenda, sizeof(m->agenda) - 1);
    strncpy(m->location, location, sizeof(m->location) - 1);
    strncpy(m->outcome, outcome, sizeof(m->outcome) - 1);

    char tempAttendees[1024];
    strncpy(tempAttendees, attendeesCsv, sizeof(tempAttendees) - 1);
    tempAttendees[sizeof(tempAttendees) - 1] = '\0';
    char* attendee = strtok(tempAttendees, ",");
    int i = 0;
    while (attendee && i < MAX_ATTENDEES) {
        strncpy(m->attendees[i], attendee, MAX_NAME_LEN - 1);
        attendee = strtok(NULL, ",");
        i++;
    }
    m->numAttendees = i;

    meetingCount++;
}

const char* deleteMeeting(int id) {
    for (int i = 0; i < meetingCount; i++) {
        if (meetings[i].id == id) {
            for (int j = i; j < meetingCount - 1; j++) meetings[j] = meetings[j + 1];
            meetingCount--;
            return NULL;
        }
    }
    return "Meeting not found";
}

void searchMeetings(const char* type, const char* query) {
    printf("[");
    int count = 0;
    for (int i = 0; i < meetingCount; i++) {
        bool match = false;
        Meeting* m = &meetings[i];
        if (strcmp(type, "date") == 0) match = strstr(m->date, query) != NULL;
        else if (strcmp(type, "agenda") == 0) match = strstr(m->agenda, query) != NULL;
        else if (strcmp(type, "outcome") == 0) match = strstr(m->outcome, query) != NULL;
        else if (strcmp(type, "attendee") == 0) {
            for (int j = 0; j < m->numAttendees; j++) {
                if (strstr(m->attendees[j], query)) { match = true; break; }
            }
        }
        if (match) {
            if (count++ > 0) printf(",");
            printMeetingJson(m);
        }
    }
    printf("]");
}

int main(int argc, char* argv[]) {
    loadFromStdin();

    printf("{\"result\":");

    if (argc < 2 || strcmp(argv[1], "list") == 0) {
        printAllJson();
    } else if (strcmp(argv[1], "add") == 0 && argc == 10) {
        addMeeting(atoi(argv[2]), argv[3], argv[4], argv[5], argv[6], argv[7], argv[8], argv[9]);
        printf("{\"status\":\"success\",\"message\":\"Meeting added successfully\"}");
    } else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        const char* err = deleteMeeting(atoi(argv[2]));
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Meeting deleted successfully\"}");
    } else if (strcmp(argv[1], "search") == 0 && argc == 4) {
        searchMeetings(argv[2], argv[3]);
    } else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
    }

    printf(",\"state\":");
    printAllJson();
    printf("}");

    free(meetings);
    return 0;
}
