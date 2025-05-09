#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>

#define FILE_NAME "vendorsds.csv"

// Vendor structure
struct Vendor {
    int id;
    char name[50];
    char phone[15];
    char email[50];
    char workDescription[100];
    float cost;
    char startDate[10];
    char endDate[10];
};

// BST Node
struct BSTNode {
    struct Vendor vendor;
    struct BSTNode* left;
    struct BSTNode* right;
};

// Min Heap
#define MAX_HEAP_SIZE 1000
struct Vendor* minHeap[MAX_HEAP_SIZE];
int heapSize = 0;

struct BSTNode* root = NULL;

// --- Utility Function Declarations ---
bool isDuplicateId(int id);
bool isValidId(int id);
bool isValidName(const char* name);
bool isValidPhone(const char* phone);
bool isValidEmail(const char* email);
bool isValidCost(float cost);
bool isValidDate(const char* date);
int getValidatedInt(const char* prompt);
float getValidatedFloat(const char* prompt);
void getValidatedString(const char* prompt, char* buffer, int size, bool (*validator)(const char*));

// --- BST Functions ---
struct BSTNode* insertBST(struct BSTNode* node, struct Vendor vendor) {
    if (node == NULL) {
        struct BSTNode* newNode = (struct BSTNode*)malloc(sizeof(struct BSTNode));
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

struct BSTNode* deleteBST(struct BSTNode* root, int id) {
    if (!root) return NULL;
    if (id < root->vendor.id) root->left = deleteBST(root->left, id);
    else if (id > root->vendor.id) root->right = deleteBST(root->right, id);
    else {
        if (!root->left) {
            struct BSTNode* temp = root->right;
            free(root);
            return temp;
        }
        if (!root->right) {
            struct BSTNode* temp = root->left;
            free(root);
            return temp;
        }
        struct BSTNode* temp = findMin(root->right);
        root->vendor = temp->vendor;
        root->right = deleteBST(root->right, temp->vendor.id);
    }
    return root;
}

void inOrderBST(struct BSTNode* node) {
    if (!node) return;
    inOrderBST(node->left);
    displayVendor(&node->vendor);
    inOrderBST(node->right);
}

// --- Min Heap Functions ---
void swap(int i, int j) {
    struct Vendor* temp = minHeap[i];
    minHeap[i] = minHeap[j];
    minHeap[j] = temp;
}

void insertHeap(struct Vendor* vendor) {
    minHeap[heapSize] = vendor;
    int i = heapSize++;
    while (i > 0 && minHeap[i]->cost < minHeap[(i - 1) / 2]->cost) {
        swap(i, (i - 1) / 2);
        i = (i - 1) / 2;
    }
}

void removeFromHeap(int id) {
    int i;
    for (i = 0; i < heapSize; i++) {
        if (minHeap[i]->id == id) break;
    }
    if (i == heapSize) return;
    minHeap[i] = minHeap[--heapSize];
    int parent = (i - 1) / 2;
    if (i > 0 && minHeap[i]->cost < minHeap[parent]->cost) {
        while (i > 0 && minHeap[i]->cost < minHeap[parent]->cost) {
            swap(i, parent);
            i = parent;
            parent = (i - 1) / 2;
        }
    } else {
        while (true) {
            int smallest = i;
            int left = 2 * i + 1;
            int right = 2 * i + 2;
            if (left < heapSize && minHeap[left]->cost < minHeap[smallest]->cost) smallest = left;
            if (right < heapSize && minHeap[right]->cost < minHeap[smallest]->cost) smallest = right;
            if (smallest == i) break;
            swap(i, smallest);
            i = smallest;
        }
    }
}

void showMinCostVendor() {
    if (heapSize == 0) {
        printf("No vendors available.\n");
        return;
    }
    printf("\n--- Vendor with Minimum Cost ---\n");
    displayVendor(minHeap[0]);
}

// --- File and Data Operations ---
bool isDuplicateId(int id) {
    return searchBST(root, id) != NULL;
}

bool isValidId(int id) { return id > 0; }
bool isValidName(const char* name) {int i; for (i = 0; name[i]; i++) if (!isalpha(name[i]) && name[i] != ' ') return false; return true; }
bool isValidPhone(const char* phone) { return strlen(phone) == 10 && strspn(phone, "0123456789") == 10; }
bool isValidEmail(const char* email) { return strchr(email, '@') && strchr(email, '.'); }
bool isValidCost(float cost) { return cost > 0; }
bool isValidDate(const char* date) { return strlen(date) == 7 && date[2] == '/' && isdigit(date[0]) && isdigit(date[1]) && isdigit(date[3]); }

int getValidatedInt(const char* prompt) {
    int x; char buf[100];
    while (1) {
        printf("%s", prompt); fgets(buf, sizeof(buf), stdin);
        if (sscanf(buf, "%d", &x) == 1 && isValidId(x)) return x;
        printf("Invalid input. Try again.\n");
    }
}

float getValidatedFloat(const char* prompt) {
    float x; char buf[100];
    while (1) {
        printf("%s", prompt); fgets(buf, sizeof(buf), stdin);
        if (sscanf(buf, "%f", &x) == 1 && isValidCost(x)) return x;
        printf("Invalid input. Try again.\n");
    }
}

void getValidatedString(const char* prompt, char* buffer, int size, bool (*validator)(const char*)) {
    while (1) {
        printf("%s", prompt);
        fgets(buffer, size, stdin);
        buffer[strcspn(buffer, "\n")] = 0;
        if (validator(buffer)) return;
        printf("Invalid input. Try again.\n");
    }
}

void loadFromFile() {
    FILE* file = fopen(FILE_NAME, "r");
    if (!file) return;

    char line[400];
    while (fgets(line, sizeof(line), file)) {
        struct Vendor v;
        sscanf(line, "%d,%49[^,],%14[^,],%49[^,],%99[^,],%f,%9[^,],%9[^\n]",
            &v.id, v.name, v.phone, v.email, v.workDescription, &v.cost, v.startDate, v.endDate);
        struct Vendor* heapVendor = malloc(sizeof(struct Vendor));
        *heapVendor = v;
        root = insertBST(root, v);
        insertHeap(heapVendor);
    }
    fclose(file);
}

void saveToFile() {
    FILE* file = fopen(FILE_NAME, "w");
    if (!file) return;
    void writeInOrder(struct BSTNode* node) {
        if (!node) return;
        writeInOrder(node->left);
        fprintf(file, "%d,%s,%s,%s,%s,%.2f,%s,%s\n", node->vendor.id, node->vendor.name, node->vendor.phone,
            node->vendor.email, node->vendor.workDescription, node->vendor.cost, node->vendor.startDate, node->vendor.endDate);
        writeInOrder(node->right);
    }
    writeInOrder(root);
    fclose(file);
}

void displayVendor(struct Vendor* v) {
    printf("\nID: %d\nName: %s\nPhone: %s\nEmail: %s\nWork: %s\nCost: %.2f\nStart: %s\nEnd: %s\n",
        v->id, v->name, v->phone, v->email, v->workDescription, v->cost, v->startDate, v->endDate);
}

void addVendor() {
    struct Vendor v;
    v.id = getValidatedInt("Enter ID: ");
    if (isDuplicateId(v.id)) { printf("ID exists.\n"); return; }
    getValidatedString("Enter name: ", v.name, 50, isValidName);
    getValidatedString("Enter phone: ", v.phone, 15, isValidPhone);
    getValidatedString("Enter email: ", v.email, 50, isValidEmail);
    printf("Enter work description: ");
    fgets(v.workDescription, sizeof(v.workDescription), stdin);
    v.workDescription[strcspn(v.workDescription, "\n")] = 0;
    v.cost = getValidatedFloat("Enter cost: ");
    getValidatedString("Enter start date (MM/YYYY): ", v.startDate, 10, isValidDate);
    getValidatedString("Enter end date (MM/YYYY): ", v.endDate, 10, isValidDate);

    struct Vendor* heapVendor = malloc(sizeof(struct Vendor));
    *heapVendor = v;
    root = insertBST(root, v);
    insertHeap(heapVendor);
    saveToFile();
    printf("Vendor added.\n");
}

void listVendors() {
    printf("\n--- Vendor List ---\n");
    inOrderBST(root);
}

void searchVendorById() {
    int id = getValidatedInt("Enter ID to search: ");
    struct BSTNode* node = searchBST(root, id);
    if (node) displayVendor(&node->vendor);
    else printf("Vendor not found.\n");
}

void deleteVendor() {
    int id = getValidatedInt("Enter ID to delete: ");
    if (!isDuplicateId(id)) { printf("ID not found.\n"); return; }
    root = deleteBST(root, id);
    removeFromHeap(id);
    saveToFile();
    printf("Vendor deleted.\n");
}

int main() {
    loadFromFile();
    int choice;

    while (1) {
        printf("\n--- Vendor Management ---\n");
        printf("1. Add Vendor\n");
        printf("2. List Vendors\n");
        printf("3. Search Vendor by ID\n");
        printf("4. Delete Vendor\n");
        printf("5. Show Vendor with Minimum Cost\n");
        printf("6. Exit\n");

        choice = getValidatedInt("Enter your choice: ");

        switch (choice) {
            case 1: addVendor(); break;
            case 2: listVendors(); break;
            case 3: searchVendorById(); break;
            case 4: deleteVendor(); break;
            case 5: showMinCostVendor(); break;
            case 6:
                saveToFile();
                printf("Exiting...\n");
                return 0;
            default: printf("Invalid choice.\n");
        }
    }
}
