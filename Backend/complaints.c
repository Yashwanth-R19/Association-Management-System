// Complaints/helpdesk module: a FIFO queue (singly linked list). Normal-
// priority complaints enqueue at the tail; high-priority ones jump the queue
// by enqueuing at the head — the simplest structure that captures "urgent
// issues get looked at first" without pulling in a full heap for a module
// this small. Stateless per-request compute engine, same stdin/stdout
// {"result", "state"} contract as every other module.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct ComplaintNode {
    int id;
    char title[100];
    char description[512];
    char priority[10]; // low | normal | high
    char status[15];   // open | in_progress | resolved
    char raisedBy[50];
    char assignedTo[50];
    long createdAt;
    long resolvedAt; // 0 = not resolved
    struct ComplaintNode* next;
} ComplaintNode;

ComplaintNode* head = NULL;
ComplaintNode* tail = NULL;

void escapeJsonString(const char* input, FILE* output) {
    while (*input) {
        switch (*input) {
            case '"': fputs("\\\"", output); break;
            case '\\': fputs("\\\\", output); break;
            case '\n': fputs("\\n", output); break;
            case '\r': fputs("\\r", output); break;
            default: fputc(*input, output);
        }
        input++;
    }
}

void printComplaintJson(ComplaintNode* c) {
    printf("{\"id\":%d,\"title\":\"", c->id);
    escapeJsonString(c->title, stdout);
    printf("\",\"description\":\"");
    escapeJsonString(c->description, stdout);
    printf("\",\"priority\":\"%s\",\"status\":\"%s\",\"raisedBy\":\"", c->priority, c->status);
    escapeJsonString(c->raisedBy, stdout);
    printf("\",\"assignedTo\":\"");
    escapeJsonString(c->assignedTo, stdout);
    printf("\",\"createdAt\":%ld,\"resolvedAt\":%ld}", c->createdAt, c->resolvedAt);
}

void printAllJson() {
    printf("[");
    ComplaintNode* cur = head;
    int first = 1;
    while (cur) {
        if (!first) printf(","); else first = 0;
        printComplaintJson(cur);
        cur = cur->next;
    }
    printf("]");
}

void enqueue(ComplaintNode* node) {
    node->next = NULL;
    if (strcmp(node->priority, "high") == 0) {
        node->next = head;
        head = node;
        if (!tail) tail = node;
        return;
    }
    if (!head) { head = tail = node; return; }
    tail->next = node;
    tail = node;
}

ComplaintNode* makeComplaint(int id, const char* title, const char* description, const char* priority,
                              const char* status, const char* raisedBy, const char* assignedTo,
                              long createdAt, long resolvedAt) {
    ComplaintNode* c = malloc(sizeof(ComplaintNode));
    c->id = id;
    strncpy(c->title, title, sizeof(c->title) - 1); c->title[sizeof(c->title) - 1] = '\0';
    strncpy(c->description, description, sizeof(c->description) - 1); c->description[sizeof(c->description) - 1] = '\0';
    strncpy(c->priority, priority, sizeof(c->priority) - 1); c->priority[sizeof(c->priority) - 1] = '\0';
    strncpy(c->status, status, sizeof(c->status) - 1); c->status[sizeof(c->status) - 1] = '\0';
    strncpy(c->raisedBy, raisedBy, sizeof(c->raisedBy) - 1); c->raisedBy[sizeof(c->raisedBy) - 1] = '\0';
    strncpy(c->assignedTo, assignedTo, sizeof(c->assignedTo) - 1); c->assignedTo[sizeof(c->assignedTo) - 1] = '\0';
    c->createdAt = createdAt;
    c->resolvedAt = resolvedAt;
    c->next = NULL;
    return c;
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

// Reads stdin CSV: id,"title","description","priority","status","raisedBy","assignedTo",createdAt,resolvedAt
void loadFromStdin() {
    char line[900];
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\n")] = '\0';
        if (line[0] == '\0') continue;

        char* cursor = line;
        int id = atoi(nextField(&cursor));
        char* title = nextField(&cursor);
        char* description = nextField(&cursor);
        char* priority = nextField(&cursor);
        char* status = nextField(&cursor);
        char* raisedBy = nextField(&cursor);
        char* assignedTo = nextField(&cursor);
        long createdAt = atol(nextField(&cursor));
        long resolvedAt = atol(nextField(&cursor));

        ComplaintNode* c = makeComplaint(id, title, description, priority, status, raisedBy, assignedTo, createdAt, resolvedAt);
        // Preserve existing queue order/priority placement rather than re-deriving it.
        c->next = NULL;
        if (!head) { head = tail = c; }
        else { tail->next = c; tail = c; }
    }
}

ComplaintNode* findById(int id) {
    ComplaintNode* cur = head;
    while (cur) { if (cur->id == id) return cur; cur = cur->next; }
    return NULL;
}

const char* assignComplaint(int id, const char* assignedTo) {
    ComplaintNode* c = findById(id);
    if (!c) return "Complaint not found";
    strncpy(c->assignedTo, assignedTo, sizeof(c->assignedTo) - 1);
    c->assignedTo[sizeof(c->assignedTo) - 1] = '\0';
    if (strcmp(c->status, "open") == 0) strcpy(c->status, "in_progress");
    return NULL;
}

const char* resolveComplaint(int id, long resolvedAt) {
    ComplaintNode* c = findById(id);
    if (!c) return "Complaint not found";
    strcpy(c->status, "resolved");
    c->resolvedAt = resolvedAt;
    return NULL;
}

const char* deleteComplaint(int id) {
    ComplaintNode* cur = head;
    ComplaintNode* prev = NULL;
    while (cur) {
        if (cur->id == id) {
            if (prev) prev->next = cur->next; else head = cur->next;
            if (tail == cur) tail = prev;
            free(cur);
            return NULL;
        }
        prev = cur;
        cur = cur->next;
    }
    return "Complaint not found";
}

void searchComplaints(const char* type, const char* value) {
    printf("[");
    int first = 1;
    ComplaintNode* cur = head;
    while (cur) {
        int match = 0;
        if (strcmp(type, "status") == 0 && strcmp(cur->status, value) == 0) match = 1;
        else if (strcmp(type, "priority") == 0 && strcmp(cur->priority, value) == 0) match = 1;
        else if (strcmp(type, "title") == 0 && strstr(cur->title, value)) match = 1;
        if (match) {
            if (!first) printf(","); else first = 0;
            printComplaintJson(cur);
        }
        cur = cur->next;
    }
    printf("]");
}

int main(int argc, char* argv[]) {
    loadFromStdin();

    printf("{\"result\":");

    if (argc < 2 || strcmp(argv[1], "list") == 0) {
        printAllJson();
    } else if (strcmp(argv[1], "add") == 0 && argc == 8) {
        // argv layout: add <id> <title> <description> <priority> <raisedBy> <createdAt>
        int id = atoi(argv[2]);
        long createdAt = atol(argv[7]);
        ComplaintNode* c = makeComplaint(id, argv[3], argv[4], argv[5], "open", argv[6], "", createdAt, 0);
        enqueue(c);
        printf("{\"status\":\"success\",\"message\":\"Complaint submitted\"}");
    } else if (strcmp(argv[1], "assign") == 0 && argc == 4) {
        const char* err = assignComplaint(atoi(argv[2]), argv[3]);
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Complaint assigned\"}");
    } else if (strcmp(argv[1], "resolve") == 0 && argc == 4) {
        const char* err = resolveComplaint(atoi(argv[2]), atol(argv[3]));
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Complaint resolved\"}");
    } else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        const char* err = deleteComplaint(atoi(argv[2]));
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Complaint deleted\"}");
    } else if (strcmp(argv[1], "search") == 0 && argc == 4) {
        searchComplaints(argv[2], argv[3]);
    } else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
    }

    printf(",\"state\":");
    printAllJson();
    printf("}");

    return 0;
}
