// Facility booking module. Two structures built fresh from stdin each call:
// a hash table of bookings keyed by resident door number (for listing/search
// — the module's original DS), and a per-facility timeline: a linked list of
// bookings sorted by start time, used to reject overlapping bookings with an
// early-exit scan (once a candidate's start time is past the new booking's
// end time, nothing later in the sorted list can overlap either).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define TABLE_SIZE 101

typedef struct Booking {
    char facility[20];
    char residentID[50];
    char residentName[50];
    long startEpoch;
    long endEpoch;
    struct Booking* next; // resident-hash chain
} Booking;

Booking* residentBuckets[TABLE_SIZE];

typedef struct TimelineNode {
    Booking* booking;
    struct TimelineNode* next; // sorted ascending by startEpoch
} TimelineNode;

typedef struct FacilityTimeline {
    char facilityName[20];
    TimelineNode* head;
    struct FacilityTimeline* next;
} FacilityTimeline;

FacilityTimeline* facilities = NULL;

unsigned int hashKey(const char* key) {
    unsigned long h = 5381;
    int c;
    while ((c = *key++)) h = ((h << 5) + h) + c;
    return h % TABLE_SIZE;
}

FacilityTimeline* findOrCreateTimeline(const char* name) {
    FacilityTimeline* t = facilities;
    while (t) {
        if (strcmp(t->facilityName, name) == 0) return t;
        t = t->next;
    }
    FacilityTimeline* nt = malloc(sizeof(FacilityTimeline));
    strncpy(nt->facilityName, name, sizeof(nt->facilityName) - 1);
    nt->facilityName[sizeof(nt->facilityName) - 1] = '\0';
    nt->head = NULL;
    nt->next = facilities;
    facilities = nt;
    return nt;
}

void insertIntoTimeline(FacilityTimeline* t, Booking* b) {
    TimelineNode* node = malloc(sizeof(TimelineNode));
    node->booking = b;
    if (!t->head || b->startEpoch < t->head->booking->startEpoch) {
        node->next = t->head;
        t->head = node;
        return;
    }
    TimelineNode* cur = t->head;
    while (cur->next && cur->next->booking->startEpoch <= b->startEpoch) cur = cur->next;
    node->next = cur->next;
    cur->next = node;
}

// Returns 1 if [start,end) overlaps an existing booking on this facility's timeline.
int hasOverlap(const char* facility, long start, long end) {
    FacilityTimeline* t = facilities;
    while (t && strcmp(t->facilityName, facility) != 0) t = t->next;
    if (!t) return 0;

    TimelineNode* cur = t->head;
    while (cur) {
        if (cur->booking->startEpoch >= end) break; // sorted ascending: nothing further can overlap
        if (start < cur->booking->endEpoch && end > cur->booking->startEpoch) return 1;
        cur = cur->next;
    }
    return 0;
}

Booking* createBooking(const char* facility, const char* residentID, const char* residentName, long start, long end) {
    Booking* b = malloc(sizeof(Booking));
    strncpy(b->facility, facility, sizeof(b->facility) - 1); b->facility[sizeof(b->facility) - 1] = '\0';
    strncpy(b->residentID, residentID, sizeof(b->residentID) - 1); b->residentID[sizeof(b->residentID) - 1] = '\0';
    strncpy(b->residentName, residentName, sizeof(b->residentName) - 1); b->residentName[sizeof(b->residentName) - 1] = '\0';
    b->startEpoch = start;
    b->endEpoch = end;
    b->next = NULL;
    return b;
}

void registerBooking(Booking* b) {
    unsigned int idx = hashKey(b->residentID);
    b->next = residentBuckets[idx];
    residentBuckets[idx] = b;
    insertIntoTimeline(findOrCreateTimeline(b->facility), b);
}

void printBookingJson(Booking* b) {
    printf("{\"facility\":\"%s\",\"residentID\":\"%s\",\"residentName\":\"%s\",\"startTime\":%ld,\"endTime\":%ld}",
           b->facility, b->residentID, b->residentName, b->startEpoch, b->endEpoch);
}

void printAllJson() {
    printf("[");
    int first = 1;
    for (int i = 0; i < TABLE_SIZE; i++) {
        Booking* cur = residentBuckets[i];
        while (cur) {
            if (!first) printf(","); else first = 0;
            printBookingJson(cur);
            cur = cur->next;
        }
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

// Reads stdin CSV: "facility","residentID","residentName",startEpoch,endEpoch
void loadFromStdin() {
    char line[300];
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\n")] = '\0';
        if (line[0] == '\0') continue;

        char* cursor = line;
        char facility[20], residentID[50], residentName[50];
        strncpy(facility, nextField(&cursor), sizeof(facility) - 1); facility[sizeof(facility) - 1] = '\0';
        strncpy(residentID, nextField(&cursor), sizeof(residentID) - 1); residentID[sizeof(residentID) - 1] = '\0';
        strncpy(residentName, nextField(&cursor), sizeof(residentName) - 1); residentName[sizeof(residentName) - 1] = '\0';
        long start = atol(nextField(&cursor));
        long end = atol(nextField(&cursor));

        registerBooking(createBooking(facility, residentID, residentName, start, end));
    }
}

void searchJson(const char* type, const char* value) {
    printf("[");
    int first = 1;
    for (int i = 0; i < TABLE_SIZE; i++) {
        Booking* cur = residentBuckets[i];
        while (cur) {
            int match = 0;
            if (strcmp(type, "resident") == 0 && strstr(cur->residentName, value)) match = 1;
            else if (strcmp(type, "door") == 0 && strstr(cur->residentID, value)) match = 1;
            else if (strcmp(type, "facility") == 0 && strstr(cur->facility, value)) match = 1;
            else if (strcmp(type, "date") == 0) {
                char dateStr[11];
                time_t t = (time_t)cur->startEpoch;
                strftime(dateStr, sizeof(dateStr), "%Y-%m-%d", localtime(&t));
                if (strstr(dateStr, value)) match = 1;
            }
            if (match) {
                if (!first) printf(","); else first = 0;
                printBookingJson(cur);
            }
            cur = cur->next;
        }
    }
    printf("]");
}

int main(int argc, char* argv[]) {
    loadFromStdin();

    printf("{\"result\":");

    if (argc < 2 || strcmp(argv[1], "list") == 0) {
        printAllJson();
    } else if (strcmp(argv[1], "book") == 0 && argc == 7) {
        const char* facility = argv[2];
        const char* residentID = argv[3];
        const char* residentName = argv[4];
        long start = atol(argv[5]);
        long end = atol(argv[6]);

        if (end <= start) {
            printf("{\"status\":\"error\",\"message\":\"End time must be after start time\"}");
        } else if (hasOverlap(facility, start, end)) {
            printf("{\"status\":\"error\",\"message\":\"This slot overlaps with an existing booking for %s\"}", facility);
        } else {
            registerBooking(createBooking(facility, residentID, residentName, start, end));
            printf("{\"status\":\"success\",\"message\":\"Booking confirmed\"}");
        }
    } else if (strcmp(argv[1], "search") == 0 && argc == 4) {
        searchJson(argv[2], argv[3]);
    } else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
    }

    printf(",\"state\":");
    printAllJson();
    printf("}");

    return 0;
}
