// Association members module: singly linked list. Stateless per-request
// compute engine — reads current rows as CSV on stdin (no header line, Node
// controls the exact format on both ends), performs one operation, prints
// {"result": ..., "state": [...]}. Node computes the next member id (from
// the current max) before calling "add", so id collisions from
// user-supplied ids are no longer possible.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define MAX_NAME_LEN 100
#define MAX_CONTACT_LEN 20
#define MAX_EMAIL_LEN 100
#define MAX_ROLE_LEN 50
#define MAX_DOOR_LEN 20
#define MAX_MEMBERS 300

typedef struct MemberNode {
    int memberId;
    char name[MAX_NAME_LEN];
    char contact[MAX_CONTACT_LEN];
    char email[MAX_EMAIL_LEN];
    char role[MAX_ROLE_LEN];
    char doorNumber[MAX_DOOR_LEN];
    struct MemberNode *next;
} MemberNode;

MemberNode *memberList = NULL;
int memberCount = 0;

void escapeJsonString(const char *input, FILE *output) {
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

void printMemberJson(MemberNode *m) {
    printf("{\"id\":%d,\"name\":\"", m->memberId);
    escapeJsonString(m->name, stdout);
    printf("\",\"role\":\"");
    escapeJsonString(m->role, stdout);
    printf("\",\"email\":\"");
    escapeJsonString(m->email, stdout);
    printf("\",\"phone\":\"");
    escapeJsonString(m->contact, stdout);
    printf("\",\"houseNumber\":\"");
    escapeJsonString(m->doorNumber, stdout);
    printf("\"}");
}

void printAllMembersJson() {
    printf("[");
    MemberNode *current = memberList;
    int first = 1;
    while (current != NULL) {
        if (!first) printf(","); else first = 0;
        printMemberJson(current);
        current = current->next;
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

// Reads stdin CSV: id,"name","role","email","phone","doorNumber" (no header)
void loadFromStdin() {
    char line[1024];
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\n")] = 0;
        if (line[0] == '\0') continue;

        MemberNode *newNode = (MemberNode *)malloc(sizeof(MemberNode));
        if (!newNode) continue;

        char* cursor = line;
        newNode->memberId = atoi(nextField(&cursor));
        strncpy(newNode->name, nextField(&cursor), MAX_NAME_LEN - 1); newNode->name[MAX_NAME_LEN - 1] = '\0';
        strncpy(newNode->role, nextField(&cursor), MAX_ROLE_LEN - 1); newNode->role[MAX_ROLE_LEN - 1] = '\0';
        strncpy(newNode->email, nextField(&cursor), MAX_EMAIL_LEN - 1); newNode->email[MAX_EMAIL_LEN - 1] = '\0';
        strncpy(newNode->contact, nextField(&cursor), MAX_CONTACT_LEN - 1); newNode->contact[MAX_CONTACT_LEN - 1] = '\0';
        strncpy(newNode->doorNumber, nextField(&cursor), MAX_DOOR_LEN - 1); newNode->doorNumber[MAX_DOOR_LEN - 1] = '\0';

        newNode->next = memberList;
        memberList = newNode;
        memberCount++;
        if (memberCount >= MAX_MEMBERS) break;
    }
}

const char* addMember(int id, const char* name, const char* role, const char* email, const char* phone, const char* doorNumber) {
    MemberNode *current = memberList;
    while (current != NULL) {
        if (current->memberId == id) return "Member ID already exists";
        current = current->next;
    }
    if (memberCount >= MAX_MEMBERS) return "Maximum members reached";

    MemberNode *newNode = (MemberNode *)malloc(sizeof(MemberNode));
    if (!newNode) return "Memory allocation failed";

    newNode->memberId = id;
    strncpy(newNode->name, name, MAX_NAME_LEN - 1); newNode->name[MAX_NAME_LEN - 1] = '\0';
    strncpy(newNode->role, role, MAX_ROLE_LEN - 1); newNode->role[MAX_ROLE_LEN - 1] = '\0';
    strncpy(newNode->email, email, MAX_EMAIL_LEN - 1); newNode->email[MAX_EMAIL_LEN - 1] = '\0';
    strncpy(newNode->contact, phone, MAX_CONTACT_LEN - 1); newNode->contact[MAX_CONTACT_LEN - 1] = '\0';
    strncpy(newNode->doorNumber, doorNumber, MAX_DOOR_LEN - 1); newNode->doorNumber[MAX_DOOR_LEN - 1] = '\0';

    newNode->next = memberList;
    memberList = newNode;
    memberCount++;
    return NULL;
}

const char* deleteMember(int id) {
    MemberNode *current = memberList;
    MemberNode *prev = NULL;
    while (current != NULL) {
        if (current->memberId == id) {
            if (prev == NULL) memberList = current->next;
            else prev->next = current->next;
            free(current);
            memberCount--;
            return NULL;
        }
        prev = current;
        current = current->next;
    }
    return "Member not found";
}

void searchMembers(const char* type, const char* query) {
    printf("[");
    int count = 0;
    MemberNode *current = memberList;

    while (current != NULL) {
        bool match = false;
        if (strcmp(type, "name") == 0) {
            match = strstr(current->name, query) != NULL;
        } else if (strcmp(type, "id") == 0) {
            char idStr[20];
            snprintf(idStr, sizeof(idStr), "%d", current->memberId);
            match = strstr(idStr, query) != NULL;
        } else if (strcmp(type, "role") == 0) {
            match = strstr(current->role, query) != NULL;
        } else if (strcmp(type, "house") == 0) {
            match = strstr(current->doorNumber, query) != NULL;
        }

        if (match) {
            if (count++ > 0) printf(",");
            printMemberJson(current);
        }
        current = current->next;
    }
    printf("]");
}

void freeMemberList() {
    MemberNode *current = memberList;
    while (current != NULL) {
        MemberNode *next = current->next;
        free(current);
        current = next;
    }
    memberList = NULL;
    memberCount = 0;
}

int main(int argc, char *argv[]) {
    loadFromStdin();

    printf("{\"result\":");

    if (argc < 2 || strcmp(argv[1], "list") == 0) {
        printAllMembersJson();
    } else if (strcmp(argv[1], "add") == 0 && argc == 8) {
        const char* err = addMember(atoi(argv[2]), argv[3], argv[4], argv[5], argv[6], argv[7]);
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Member added successfully\"}");
    } else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        const char* err = deleteMember(atoi(argv[2]));
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Member deleted successfully\"}");
    } else if (strcmp(argv[1], "search") == 0 && argc == 4) {
        searchMembers(argv[2], argv[3]);
    } else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
    }

    printf(",\"state\":");
    printAllMembersJson();
    printf("}");

    freeMemberList();
    return 0;
}
