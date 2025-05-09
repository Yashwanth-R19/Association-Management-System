#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdbool.h>
#include <unistd.h>
#include <sys/stat.h>

#define MAX_NAME_LENGTH 100
#define CSV_FILE "staff_data.csv"
#define DATA_DIR "../../server/data/"

typedef struct StaffNode {
    char name[MAX_NAME_LENGTH];
    char checkInTime[20];
    char checkOutTime[20];
    float wagePerHour;
    float hoursWorked;
    float earnings;
    struct StaffNode* next;
} StaffNode;

StaffNode* head = NULL;
int is_space(char c) {
    return (c == ' ' || c == '\t' || c == '\n' || 
            c == '\v' || c == '\f' || c == '\r');
}
// Helper function to trim whitespace
char* trim(char* str) {
    char *end;
    while(is_space((unsigned char)*str)) str++;
    if(*str == 0) return str;
    end = str + strlen(str) - 1;
    while(end > str && is_space((unsigned char)*end)) end--;
    end[1] = '\0';
    return str;
}

void loadStaffData() {
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s%s", DATA_DIR, CSV_FILE);
    
    FILE* file = fopen(filepath, "r");
    if (!file) return;

    char line[256];
    while (fgets(line, sizeof(line), file)) {
        char name[MAX_NAME_LENGTH], checkInTime[20] = "", checkOutTime[20] = "";
        float wagePerHour = 0, hoursWorked = 0, earnings = 0;

        if (sscanf(line, "%[^,],%[^,],%[^,],%f,%f,%f", 
                  name, checkInTime, checkOutTime, &wagePerHour, &hoursWorked, &earnings) >= 1) {
            StaffNode* newNode = malloc(sizeof(StaffNode));
            strncpy(newNode->name, trim(name), MAX_NAME_LENGTH);
            strncpy(newNode->checkInTime, checkInTime, 20);
            strncpy(newNode->checkOutTime, checkOutTime, 20);
            newNode->wagePerHour = wagePerHour;
            newNode->hoursWorked = hoursWorked;
            newNode->earnings = earnings;
            newNode->next = NULL;

            if (!head) {
                head = newNode;
            } else {
                StaffNode* current = head;
                while (current->next) current = current->next;
                current->next = newNode;
            }
        }
    }
    fclose(file);
}

void saveStaffData() {
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s%s", DATA_DIR, CSV_FILE);
    
    FILE* file = fopen(filepath, "w");
    if (!file) {
        printf("{\"status\":\"error\",\"message\":\"Failed to save data\"}\n");
        return;
    }

    StaffNode* current = head;
    while (current) {
        fprintf(file, "%s,%s,%s,%.2f,%.2f,%.2f\n", 
                current->name, current->checkInTime, current->checkOutTime,
                current->wagePerHour, current->hoursWorked, current->earnings);
        current = current->next;
    }
    fclose(file);
}

char* getCurrentTime() {
    static char timeStr[20];
    time_t now = time(NULL);
    struct tm* tm_info = localtime(&now);
    strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", tm_info);
    return timeStr;
}

float calculateHours(const char* checkIn, const char* checkOut) {
    struct tm tm1 = {0}, tm2 = {0};
    sscanf(checkIn, "%d-%d-%d %d:%d:%d", 
           &tm1.tm_year, &tm1.tm_mon, &tm1.tm_mday,
           &tm1.tm_hour, &tm1.tm_min, &tm1.tm_sec);
    tm1.tm_year -= 1900;
    tm1.tm_mon -= 1;

    sscanf(checkOut, "%d-%d-%d %d:%d:%d",
           &tm2.tm_year, &tm2.tm_mon, &tm2.tm_mday,
           &tm2.tm_hour, &tm2.tm_min, &tm2.tm_sec);
    tm2.tm_year -= 1900;
    tm2.tm_mon -= 1;

    time_t t1 = mktime(&tm1);
    time_t t2 = mktime(&tm2);
    return difftime(t2, t1) / 3600.0;
}

void addStaff(const char* name, float wage) {
    StaffNode* current = head;
    while (current) {
        if (strcmp(current->name, name) == 0 && current->checkOutTime[0] == '\0') {
            printf("{\"status\":\"error\",\"message\":\"Staff already checked in\"}\n");
            return;
        }
        current = current->next;
    }

    StaffNode* newNode = malloc(sizeof(StaffNode));
    strncpy(newNode->name, name, MAX_NAME_LENGTH);
    strncpy(newNode->checkInTime, getCurrentTime(), 20);
    newNode->checkOutTime[0] = '\0';
    newNode->wagePerHour = wage;
    newNode->hoursWorked = 0;
    newNode->earnings = 0;
    newNode->next = NULL;

    if (!head) {
        head = newNode;
    } else {
        current = head;
        while (current->next) current = current->next;
        current->next = newNode;
    }

    saveStaffData();
    printf("{\"status\":\"success\",\"data\":{\"name\":\"%s\",\"checkIn\":\"%s\"}}\n", 
           name, newNode->checkInTime);
}

void checkOutStaff(const char* name) {
    StaffNode* current = head;
    while (current) {
        if (strcmp(current->name, name) == 0 && current->checkOutTime[0] == '\0') {
            strncpy(current->checkOutTime, getCurrentTime(), 20);
            current->hoursWorked = calculateHours(current->checkInTime, current->checkOutTime);
            current->earnings = current->hoursWorked * current->wagePerHour;
            saveStaffData();
            printf("{\"status\":\"success\",\"data\":{\"name\":\"%s\",\"hours\":%.2f,\"earnings\":%.2f}}\n",
                   name, current->hoursWorked, current->earnings);
            return;
        }
        current = current->next;
    }
    printf("{\"status\":\"error\",\"message\":\"Staff not found or already checked out\"}\n");
}

void deleteStaff(const char* name) {
    if (!head) {
        printf("{\"status\":\"error\",\"message\":\"No staff records\"}\n");
        return;
    }

    StaffNode *current = head, *prev = NULL;
    while (current) {
        if (strcmp(current->name, name) == 0) {
            if (prev) {
                prev->next = current->next;
            } else {
                head = current->next;
            }
            free(current);
            saveStaffData();
            printf("{\"status\":\"success\"}\n");
            return;
        }
        prev = current;
        current = current->next;
    }
    printf("{\"status\":\"error\",\"message\":\"Staff not found\"}\n");
}

void listStaff() {
    printf("[");
    StaffNode* current = head;
    while (current) {
        printf("{\"name\":\"%s\",\"checkIn\":\"%s\",\"checkOut\":\"%s\",\"wage\":%.2f,\"hours\":%.2f,\"earnings\":%.2f}",
               current->name, current->checkInTime, current->checkOutTime,
               current->wagePerHour, current->hoursWorked, current->earnings);
        if (current->next) printf(",");
        current = current->next;
    }
    printf("]\n");
}

void searchStaff(const char* query) {
    printf("[");
    StaffNode* current = head;
    int count = 0;
    while (current) {
        if (strstr(current->name, query)) {
            if (count > 0) printf(",");
            printf("{\"name\":\"%s\",\"checkIn\":\"%s\",\"checkOut\":\"%s\",\"wage\":%.2f,\"hours\":%.2f,\"earnings\":%.2f}",
                   current->name, current->checkInTime, current->checkOutTime,
                   current->wagePerHour, current->hoursWorked, current->earnings);
            count++;
        }
        current = current->next;
    }
    printf("]\n");
}

void freeList() {
    StaffNode* current = head;
    while (current) {
        StaffNode* next = current->next;
        free(current);
        current = next;
    }
    head = NULL;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}\n");
        return 1;
    }


    loadStaffData();

    if (strcmp(argv[1], "add") == 0 && argc == 4) {
        addStaff(argv[2], atof(argv[3]));
    } 
    else if (strcmp(argv[1], "checkout") == 0 && argc == 3) {
        checkOutStaff(argv[2]);
    } 
    else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        deleteStaff(argv[2]);
    } 
    else if (strcmp(argv[1], "list") == 0) {
        listStaff();
    } 
    else if (strcmp(argv[1], "search") == 0 && argc == 3) {
        searchStaff(argv[2]);
    } 
    else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}\n");
    }

    freeList();
    return 0;
}