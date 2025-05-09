#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>
#include <sys/stat.h> // For directory creation

#define MAX_NAME_LEN 100
#define MAX_CONTACT_LEN 20
#define MAX_EMAIL_LEN 100
#define MAX_ROLE_LEN 50
#define MAX_DOOR_LEN 20
#define MAX_MEMBERS 300
#define CSV_FILE_PATH "data/association_members.csv"

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

// Function to create directory if it doesn't exist
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

void loadMembers() {
    createDirectoryIfNotExists("server");
    createDirectoryIfNotExists("server/data");
    
    FILE *file = fopen(CSV_FILE_PATH, "r");
    if (!file) {
        file = fopen(CSV_FILE_PATH, "w");
        if (file) {
            fprintf(file, "id,name,role,email,phone,doorNumber\n");
            fclose(file);
        }
        return;
    }

    char line[1024];
    if (!fgets(line, sizeof(line), file)) {
        fclose(file);
        return;
    }

    MemberNode *tail = NULL;
    while (fgets(line, sizeof(line), file)) {
        line[strcspn(line, "\n")] = 0;
        
        MemberNode *newNode = (MemberNode *)malloc(sizeof(MemberNode));
        if (!newNode) {
            printError("Memory allocation failed");
            fclose(file);
            return;
        }

        char *token = strtok(line, ",");
        if (!token) {
            free(newNode);
            continue;
        }
        newNode->memberId = atoi(token);

        token = strtok(NULL, ",");
        if (!token) {
            free(newNode);
            continue;
        }
        strncpy(newNode->name, token, MAX_NAME_LEN-1);

        token = strtok(NULL, ",");
        if (!token) {
            free(newNode);
            continue;
        }
        strncpy(newNode->role, token, MAX_ROLE_LEN-1);

        token = strtok(NULL, ",");
        if (!token) {
            free(newNode);
            continue;
        }
        strncpy(newNode->email, token, MAX_EMAIL_LEN-1);

        token = strtok(NULL, ",");
        if (!token) {
            free(newNode);
            continue;
        }
        strncpy(newNode->contact, token, MAX_CONTACT_LEN-1);

        token = strtok(NULL, "\n");
        if (token) {
            strncpy(newNode->doorNumber, token, MAX_DOOR_LEN-1);
        }
        
        newNode->next = NULL;
        
        if (memberList == NULL) {
            memberList = newNode;
            tail = newNode;
        } else {
            tail->next = newNode;
            tail = newNode;
        }
        
        memberCount++;
        if (memberCount >= MAX_MEMBERS) break;
    }
    fclose(file);
}

void saveMembers() {
    createDirectoryIfNotExists("server");
    createDirectoryIfNotExists("server/data");
    
    FILE *file = fopen(CSV_FILE_PATH, "w");
    if (!file) {
        printError("Failed to open data file for writing");
        return;
    }

    fprintf(file, "id,name,role,email,phone,doorNumber\n");
    MemberNode *current = memberList;
    while (current != NULL) {
        fprintf(file, "%d,%s,%s,%s,%s,%s\n",
                current->memberId,
                current->name,
                current->role,
                current->email,
                current->contact,
                current->doorNumber);
        current = current->next;
    }
    fclose(file);
}

void listMembers() {
    printf("[");
    MemberNode *current = memberList;
    int first = 1;
    while (current != NULL) {
        if (!first) printf(",");
        first = 0;
        printf("{\"id\":%d,\"name\":\"", current->memberId);
        escapeJsonString(current->name, stdout);
        printf("\",\"role\":\"");
        escapeJsonString(current->role, stdout);
        printf("\",\"email\":\"");
        escapeJsonString(current->email, stdout);
        printf("\",\"phone\":\"");
        escapeJsonString(current->contact, stdout);
        printf("\",\"houseNumber\":\"");
        escapeJsonString(current->doorNumber, stdout);
        printf("\"}");
        current = current->next;
    }
    printf("]\n");
}

void addMember(int id, const char* name, const char* role, const char* email, const char* phone, const char* doorNumber) {
    // Check if ID already exists
    MemberNode *current = memberList;
    while (current != NULL) {
        if (current->memberId == id) {
            printError("Member ID already exists");
            return;
        }
        current = current->next;
    }

    if (memberCount >= MAX_MEMBERS) {
        printError("Maximum members reached");
        return;
    }

    MemberNode *newNode = (MemberNode *)malloc(sizeof(MemberNode));
    if (!newNode) {
        printError("Memory allocation failed");
        return;
    }

    newNode->memberId = id;
    strncpy(newNode->name, name, MAX_NAME_LEN-1);
    strncpy(newNode->role, role, MAX_ROLE_LEN-1);
    strncpy(newNode->email, email, MAX_EMAIL_LEN-1);
    strncpy(newNode->contact, phone, MAX_CONTACT_LEN-1);
    strncpy(newNode->doorNumber, doorNumber, MAX_DOOR_LEN-1);
    
    // Add to beginning of list
    newNode->next = memberList;
    memberList = newNode;
    
    memberCount++;
    saveMembers();
    printSuccess("Member added successfully");
}

void deleteMember(int id) {
    MemberNode *current = memberList;
    MemberNode *prev = NULL;
    
    while (current != NULL) {
        if (current->memberId == id) {
            if (prev == NULL) {
                memberList = current->next;
            } else {
                prev->next = current->next;
            }
            free(current);
            memberCount--;
            saveMembers();
            printSuccess("Member deleted successfully");
            return;
        }
        prev = current;
        current = current->next;
    }
    printError("Member not found");
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
            printf("{\"id\":%d,\"name\":\"", current->memberId);
            escapeJsonString(current->name, stdout);
            printf("\",\"role\":\"");
            escapeJsonString(current->role, stdout);
            printf("\",\"email\":\"");
            escapeJsonString(current->email, stdout);
            printf("\",\"phone\":\"");
            escapeJsonString(current->contact, stdout);
            printf("\",\"houseNumber\":\"");
            escapeJsonString(current->doorNumber, stdout);
            printf("\"}");
        }
        current = current->next;
    }
    printf("]\n");
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
    loadMembers();
    
    if (argc < 2) {
        listMembers();
        freeMemberList();
        return 0;
    }
    
    if (strcmp(argv[1], "add") == 0 && argc == 8) {
        addMember(atoi(argv[2]), argv[3], argv[4], argv[5], argv[6], argv[7]);
    } 
    else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        deleteMember(atoi(argv[2]));
    }
    else if (strcmp(argv[1], "search") == 0 && argc == 4) {
        searchMembers(argv[2], argv[3]);
    }
    else if (strcmp(argv[1], "list") == 0) {
        listMembers();
    }
    else {
        printError("Invalid command");
    }
    
    freeMemberList();
    return 0;
}