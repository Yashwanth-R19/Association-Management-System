// Vendor module: BST keyed by vendor id, a min-heap by cost, and a max-heap
// by average rating (mirrors the dual-heap pattern already used in staff.c).
// Stateless per-request compute engine: stdin carries the current vendors
// (Node includes each vendor's avg_rating, computed from the separate
// vendor_ratings table, as an extra column purely for this request's
// best-value/top-rated calculations — it is not persisted back by Node).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>

#define MAX_VENDORS 1000

struct Vendor {
    int id;
    char name[50];
    char phone[15];
    char email[50];
    char workDescription[100];
    float cost;
    char startDate[16];
    char endDate[16];
    float avgRating; // 0 = unrated
};

struct BSTNode {
    struct Vendor vendor;
    struct BSTNode* left;
    struct BSTNode* right;
};

struct Vendor* minHeapByCost[MAX_VENDORS];
int costHeapSize = 0;
struct Vendor* maxHeapByRating[MAX_VENDORS];
int ratingHeapSize = 0;

struct BSTNode* root = NULL;

struct BSTNode* insertBST(struct BSTNode* node, struct Vendor vendor) {
    if (node == NULL) {
        struct BSTNode* newNode = malloc(sizeof(struct BSTNode));
        newNode->vendor = vendor;
        newNode->left = newNode->right = NULL;
        return newNode;
    }
    if (vendor.id < node->vendor.id) node->left = insertBST(node->left, vendor);
    else if (vendor.id > node->vendor.id) node->right = insertBST(node->right, vendor);
    return node;
}

struct BSTNode* searchBST(struct BSTNode* node, int id) {
    if (node == NULL || node->vendor.id == id) return node;
    if (id < node->vendor.id) return searchBST(node->left, id);
    return searchBST(node->right, id);
}

struct BSTNode* findMin(struct BSTNode* node) {
    while (node->left != NULL) node = node->left;
    return node;
}

struct BSTNode* deleteBST(struct BSTNode* node, int id) {
    if (!node) return NULL;
    if (id < node->vendor.id) node->left = deleteBST(node->left, id);
    else if (id > node->vendor.id) node->right = deleteBST(node->right, id);
    else {
        if (!node->left) { struct BSTNode* t = node->right; free(node); return t; }
        if (!node->right) { struct BSTNode* t = node->left; free(node); return t; }
        struct BSTNode* t = findMin(node->right);
        node->vendor = t->vendor;
        node->right = deleteBST(node->right, t->vendor.id);
    }
    return node;
}

void inOrderCollect(struct BSTNode* node, struct Vendor** out, int* count) {
    if (!node) return;
    inOrderCollect(node->left, out, count);
    out[(*count)++] = &node->vendor;
    inOrderCollect(node->right, out, count);
}

void heapSwap(struct Vendor** heap, int i, int j) {
    struct Vendor* t = heap[i]; heap[i] = heap[j]; heap[j] = t;
}

void insertMinHeapByCost(struct Vendor* v) {
    minHeapByCost[costHeapSize] = v;
    int i = costHeapSize++;
    while (i > 0 && minHeapByCost[i]->cost < minHeapByCost[(i - 1) / 2]->cost) {
        heapSwap(minHeapByCost, i, (i - 1) / 2);
        i = (i - 1) / 2;
    }
}

void insertMaxHeapByRating(struct Vendor* v) {
    maxHeapByRating[ratingHeapSize] = v;
    int i = ratingHeapSize++;
    while (i > 0 && maxHeapByRating[i]->avgRating > maxHeapByRating[(i - 1) / 2]->avgRating) {
        heapSwap(maxHeapByRating, i, (i - 1) / 2);
        i = (i - 1) / 2;
    }
}

bool isDuplicateId(int id) { return searchBST(root, id) != NULL; }

// Restored from the original interactive-CLI vendor module (letters/spaces
// only, 10-digit phone, "@" + "." email, positive cost, MM/YY date) — dropped
// when this file was rewritten into a stateless engine. Node validates the
// same shapes before ever invoking this binary; this is the second gate.
bool isValidName(const char* name) {
    if (!name || name[0] == '\0') return false;
    for (int i = 0; name[i]; i++) {
        if (!isalpha((unsigned char)name[i]) && name[i] != ' ') return false;
    }
    return true;
}

bool isValidPhone(const char* phone) {
    if (!phone) return false;
    int len = strlen(phone);
    if (len != 10) return false;
    for (int i = 0; i < len; i++) {
        if (!isdigit((unsigned char)phone[i])) return false;
    }
    return true;
}

bool isValidEmail(const char* email) {
    if (!email) return false;
    const char* at = strchr(email, '@');
    if (!at || at == email) return false;
    const char* dot = strchr(at, '.');
    return dot != NULL && dot > at + 1;
}

bool isValidCost(float cost) { return cost > 0; }

// MM/YY, e.g. "03/25".
bool isValidDate(const char* date) {
    if (!date || strlen(date) != 5) return false;
    if (!isdigit((unsigned char)date[0]) || !isdigit((unsigned char)date[1])) return false;
    if (date[2] != '/') return false;
    if (!isdigit((unsigned char)date[3]) || !isdigit((unsigned char)date[4])) return false;
    int month = (date[0] - '0') * 10 + (date[1] - '0');
    return month >= 1 && month <= 12;
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

void printVendorJson(struct Vendor* v) {
    printf("{\"id\":%d,\"name\":\"%s\",\"phone\":\"%s\",\"email\":\"%s\",\"workDescription\":\"%s\","
           "\"cost\":%.2f,\"startDate\":\"%s\",\"endDate\":\"%s\",\"avgRating\":%.2f}",
           v->id, v->name, v->phone, v->email, v->workDescription, v->cost, v->startDate, v->endDate, v->avgRating);
}

void printAllVendorsJson() {
    struct Vendor* all[MAX_VENDORS];
    int count = 0;
    inOrderCollect(root, all, &count);
    printf("[");
    for (int i = 0; i < count; i++) {
        if (i > 0) printf(",");
        printVendorJson(all[i]);
    }
    printf("]");
}

// Reads stdin CSV: id,"name","phone","email","workDescription",cost,"startDate","endDate",avgRating
// (no header; quoted fields so empty values never collapse a column — see nextField).
void loadFromStdin() {
    char line[400];
    while (fgets(line, sizeof(line), stdin)) {
        line[strcspn(line, "\n")] = '\0';
        if (line[0] == '\0') continue;

        char* cursor = line;
        struct Vendor v = {0};
        v.id = atoi(nextField(&cursor));
        strncpy(v.name, nextField(&cursor), sizeof(v.name) - 1);
        strncpy(v.phone, nextField(&cursor), sizeof(v.phone) - 1);
        strncpy(v.email, nextField(&cursor), sizeof(v.email) - 1);
        strncpy(v.workDescription, nextField(&cursor), sizeof(v.workDescription) - 1);
        v.cost = atof(nextField(&cursor));
        strncpy(v.startDate, nextField(&cursor), sizeof(v.startDate) - 1);
        strncpy(v.endDate, nextField(&cursor), sizeof(v.endDate) - 1);
        v.avgRating = atof(nextField(&cursor));

        struct Vendor* heapVendor = malloc(sizeof(struct Vendor));
        *heapVendor = v;
        root = insertBST(root, v);
        insertMinHeapByCost(heapVendor);
        insertMaxHeapByRating(heapVendor);
    }
}

const char* addVendor(int id, const char* name, const char* phone, const char* email,
                       const char* workDescription, float cost, const char* startDate, const char* endDate) {
    if (isDuplicateId(id)) return "Vendor ID already exists";
    if (!isValidName(name)) return "Name must contain only letters and spaces";
    if (!isValidPhone(phone)) return "Phone number must be exactly 10 digits";
    if (!isValidEmail(email)) return "Email must contain '@' and '.'";
    if (!isValidCost(cost)) return "Cost must be greater than 0";
    if (startDate[0] != '\0' && !isValidDate(startDate)) return "Start date must be in MM/YY format";
    if (endDate[0] != '\0' && !isValidDate(endDate)) return "End date must be in MM/YY format";
    struct Vendor v = {0};
    v.id = id;
    strncpy(v.name, name, sizeof(v.name) - 1);
    strncpy(v.phone, phone, sizeof(v.phone) - 1);
    strncpy(v.email, email, sizeof(v.email) - 1);
    strncpy(v.workDescription, workDescription, sizeof(v.workDescription) - 1);
    v.cost = cost;
    strncpy(v.startDate, startDate, sizeof(v.startDate) - 1);
    strncpy(v.endDate, endDate, sizeof(v.endDate) - 1);
    v.avgRating = 0;

    struct Vendor* heapVendor = malloc(sizeof(struct Vendor));
    *heapVendor = v;
    root = insertBST(root, v);
    insertMinHeapByCost(heapVendor);
    insertMaxHeapByRating(heapVendor);
    return NULL;
}

const char* deleteVendor(int id) {
    if (!isDuplicateId(id)) return "Vendor not found";
    root = deleteBST(root, id);
    return NULL;
}

void searchVendors(const char* type, const char* query) {
    struct Vendor* all[MAX_VENDORS];
    int count = 0;
    inOrderCollect(root, all, &count);
    printf("[");
    int first = 1;
    for (int i = 0; i < count; i++) {
        bool match = false;
        if (strcmp(type, "id") == 0) {
            match = all[i]->id == atoi(query);
        } else {
            char lname[50], lquery[50];
            int j;
            for (j = 0; all[i]->name[j] && j < 49; j++) lname[j] = tolower((unsigned char)all[i]->name[j]);
            lname[j] = '\0';
            for (j = 0; query[j] && j < 49; j++) lquery[j] = tolower((unsigned char)query[j]);
            lquery[j] = '\0';
            match = strstr(lname, lquery) != NULL;
        }
        if (match) {
            if (!first) printf(","); else first = 0;
            printVendorJson(all[i]);
        }
    }
    printf("]");
}

void printMinCostVendor() {
    if (costHeapSize == 0) { printf("null"); return; }
    printVendorJson(minHeapByCost[0]);
}

void printBestValueVendor() {
    // Best value = highest rating-per-rupee among rated vendors; falls back to
    // cheapest overall if nobody has a rating yet.
    struct Vendor* best = NULL;
    float bestScore = -1;
    for (int i = 0; i < ratingHeapSize; i++) {
        struct Vendor* v = maxHeapByRating[i];
        if (v->avgRating <= 0 || v->cost <= 0) continue;
        float score = v->avgRating / v->cost;
        if (score > bestScore) { bestScore = score; best = v; }
    }
    if (!best) { printMinCostVendor(); return; }
    printVendorJson(best);
}

int main(int argc, char* argv[]) {
    loadFromStdin();

    printf("{\"result\":");

    if (argc < 2 || strcmp(argv[1], "list") == 0) {
        printAllVendorsJson();
    } else if (strcmp(argv[1], "add") == 0 && argc == 10) {
        const char* err = addVendor(atoi(argv[2]), argv[3], argv[4], argv[5], argv[6], atof(argv[7]), argv[8], argv[9]);
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Vendor added\"}");
    } else if (strcmp(argv[1], "delete") == 0 && argc == 3) {
        const char* err = deleteVendor(atoi(argv[2]));
        if (err) printf("{\"status\":\"error\",\"message\":\"%s\"}", err);
        else printf("{\"status\":\"success\",\"message\":\"Vendor deleted\"}");
    } else if (strcmp(argv[1], "search") == 0 && argc == 4) {
        searchVendors(argv[2], argv[3]);
    } else if (strcmp(argv[1], "min-cost") == 0) {
        printMinCostVendor();
    } else if (strcmp(argv[1], "best-value") == 0) {
        printBestValueVendor();
    } else {
        printf("{\"status\":\"error\",\"message\":\"Invalid command\"}");
    }

    printf(",\"state\":");
    printAllVendorsJson();
    printf("}");

    return 0;
}
