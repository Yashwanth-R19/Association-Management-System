// Staff module: min-heap by check-in time, max-heap by check-out time (the
// heaps drive the "list" ordering). Stateless per-request compute engine:
// stdin carries the current staff rows as CSV (id,name,wagePerHour,
// checkInEpoch,checkOutEpoch — 0 means "not checked out"), one operation
// runs, and {"result": ..., "state": [...]} is printed to stdout.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define MAX_STAFF 500

typedef struct {
    int id;
    char name[50];
    float wage;
    time_t checkIn;
    time_t checkOut; // 0 = not checked out
} Staff;

Staff all[MAX_STAFF];
int count = 0;

Staff* minHeapByCheckIn[MAX_STAFF];
int minHeapSize = 0;
Staff* maxHeapByCheckOut[MAX_STAFF];
int maxHeapSize = 0;

void heapSwap(Staff** heap, int i, int j) { Staff* t = heap[i]; heap[i] = heap[j]; heap[j] = t; }

void pushMin(Staff* s) {
    minHeapByCheckIn[minHeapSize] = s;
    int i = minHeapSize++;
    while (i > 0 && minHeapByCheckIn[i]->checkIn < minHeapByCheckIn[(i - 1) / 2]->checkIn) {
        heapSwap(minHeapByCheckIn, i, (i - 1) / 2);
        i = (i - 1) / 2;
    }
}

void pushMax(Staff* s) {
    maxHeapByCheckOut[maxHeapSize] = s;
    int i = maxHeapSize++;
    while (i > 0 && maxHeapByCheckOut[i]->checkOut > maxHeapByCheckOut[(i - 1) / 2]->checkOut) {
        heapSwap(maxHeapByCheckOut, i, (i - 1) / 2);
        i = (i - 1) / 2;
    }
}

void printStaffJson(Staff* s) {
    double hours = 0, earnings = 0;
    if (s->checkOut > 0) {
        hours = difftime(s->checkOut, s->checkIn) / 3600.0;
        earnings = hours * s->wage;
    }
    printf("{\"id\":%d,\"name\":\"%s\",\"wagePerHour\":%.2f,\"checkInTime\":%ld,\"checkOutTime\":%ld,"
           "\"hoursWorked\":%.2f,\"earnings\":%.2f}",
           s->id, s->name, s->wage, (long)s->checkIn, (long)s->checkOut, hours, earnings);
}

void printAllOrderedByCheckIn() {
    printf("[");
    for (int i = 0; i < minHeapSize; i++) {
        if (i > 0) printf(",");
        printStaffJson(minHeapByCheckIn[i]);
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

// Reads stdin CSV: id,"name",wagePerHour,checkInEpoch,checkOutEpoch (no header).
void loadFromStdin() {
    char line[300];
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\n")] = '\0';
        if (line[0] == '\0') continue;

        char* cursor = line;
        Staff s = {0};
        s.id = atoi(nextField(&cursor));
        strncpy(s.name, nextField(&cursor), sizeof(s.name) - 1);
        s.wage = atof(nextField(&cursor));
        s.checkIn = (time_t)atol(nextField(&cursor));
        s.checkOut = (time_t)atol(nextField(&cursor));
        all[count++] = s;
        if (count >= MAX_STAFF) break;
    }
    for (int i = 0; i < count; i++) {
        pushMin(&all[i]);
        if (all[i].checkOut > 0) pushMax(&all[i]);
    }
}

const char* addStaff(int id, const char* name, float wage) {
    if (count >= MAX_STAFF) return "Maximum staff reached";
    Staff* s = &all[count++];
    s->id = id;
    strncpy(s->name, name, sizeof(s->name) - 1);
    s->wage = wage;
    s->checkIn = time(NULL);
    s->checkOut = 0;
    pushMin(s);
    return NULL;
}

const char* checkOutStaff(const char* name) {
    for (int i = 0; i < count; i++) {
        if (strcmp(all[i].name, name) == 0 && all[i].checkOut == 0) {
            all[i].checkOut = time(NULL);
            pushMax(&all[i]);
            return NULL;
        }
    }
    return "No checked-in staff found with that name";
}

const char* deleteStaff(const char* name) {
    for (int i = 0; i < count; i++) {
        if (strcmp(all[i].name, name) == 0) {
            for (int j = i; j < count - 1; j++) all[j] = all[j + 1];
            count--;
            minHeapSize = 0;
            maxHeapSize = 0;
            for (int j = 0; j < count; j++) {
                pushMin(&all[j]);
                if (all[j].checkOut > 0) pushMax(&all[j]);
            }
            return NULL;
        }
    }
    return "Staff not found";
}

void searchStaff(const char* name) {
    printf("[");
    int first = 1;
    for (int i = 0; i < count; i++) {
        if (strstr(all[i].name, name)) {
            if (!first) printf(","); else first = 0;
            printStaffJson(&all[i]);
        }
    }
    printf("]");
}

int main(int argc, char* argv[]) {
    loadFromStdin();

    printf("{\"result\":");

    if (argc < 2 || strcmp(argv[1], "list") == 0) {
        printAllOrderedByCheckIn();
    } else if (strcmp(argv[1], "add") == 0 && argc == 5) {
        const char* err = addStaff(atoi(argv[2]), argv[3], atof(argv[4]));
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Staff checked in\"}");
    } else if (strcmp(argv[1], "checkout") == 0 && argc == 3) {
        const char* err = checkOutStaff(argv[2]);
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Staff checked out\"}");
    } else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        const char* err = deleteStaff(argv[2]);
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Staff deleted\"}");
    } else if (strcmp(argv[1], "search") == 0 && argc == 3) {
        searchStaff(argv[2]);
    } else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
    }

    printf(",\"state\":[");
    for (int i = 0; i < count; i++) {
        if (i > 0) printf(",");
        printStaffJson(&all[i]);
    }
    printf("]}");

    return 0;
}
