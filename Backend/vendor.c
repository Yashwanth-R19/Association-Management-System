#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>

#define FILE_NAME "vendorsds.csv"
#define OUTPUT_FILE "output.txt"
#define MAX_HEAP_SIZE 1000

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

struct BSTNode {
    struct Vendor vendor;
    struct BSTNode* left;
    struct BSTNode* right;
};

struct Vendor* minHeap[MAX_HEAP_SIZE];
int heapSize = 0;
struct BSTNode* root = NULL;

// Validations
bool isValidId(int id) { return id > 0; }
bool isValidName(const char* name) {
    for (int i = 0; name[i]; i++)
        if (!isalpha(name[i]) && name[i] != ' ') return false;
    return true;
}
bool isValidPhone(const char* phone) {
    return strlen(phone) == 10 && strspn(phone, "0123456789") == 10;
}
bool isValidEmail(const char* email) {
    return strchr(email, '@') && strchr(email, '.');
}
bool isValidCost(float cost) { return cost > 0; }
bool isValidDate(const char* date) {
    return strlen(date) == 7 && date[2] == '/' &&
           isdigit(date[0]) && isdigit(date[1]) &&
           isdigit(date[3]);
}

// Heap operations
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
        while (1) {
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

// BST operations
struct BSTNode* insertBST(struct BSTNode* node, struct Vendor vendor) {
    if (!node) {
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
    if (!node || node->vendor.id == id) return node;
    if (id < node->vendor.id) return searchBST(node->left, id);
    return searchBST(node->right, id);
}

struct BSTNode* findMin(struct BSTNode* node) {
    while (node && node->left) node = node->left;
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
        } else if (!root->right) {
            struct BSTNode* temp = root->left;
            free(root);
            return temp;
        } else {
            struct BSTNode* temp = findMin(root->right);
            root->vendor = temp->vendor;
            root->right = deleteBST(root->right, temp->vendor.id);
        }
    }
    return root;
}

// File output
void writeVendor(struct Vendor* v, FILE* out) {
    fprintf(out, "%d,%s,%s,%s,%s,%.2f,%s,%s\n",
        v->id, v->name, v->phone, v->email,
        v->workDescription, v->cost, v->startDate, v->endDate);
}

// In-order BST traversal for vendor listing
void inOrder(struct BSTNode* node, FILE* out) {
    if (!node) return;
    inOrder(node->left, out);
    writeVendor(&node->vendor, out);
    inOrder(node->right, out);
}

void listVendors() {
    FILE* out = fopen(OUTPUT_FILE, "w");
    if (out) {
        inOrder(root, out);
        fclose(out);
    }
}

// Show vendor with minimum cost
void showMinCostVendor() {
    FILE* out = fopen(OUTPUT_FILE, "w");
    if (heapSize > 0 && out) {
        writeVendor(minHeap[0], out);
        fclose(out);
    }
}

// Load vendor records from CSV file
void loadFromFile() {
    FILE* file = fopen(FILE_NAME, "r");
    if (!file) return;

    char line[400];
    while (fgets(line, sizeof(line), file)) {
        struct Vendor v;
        sscanf(line, "%d,%49[^,],%14[^,],%49[^,],%99[^,],%f,%9[^,],%9[^,\n]",
               &v.id, v.name, v.phone, v.email, v.workDescription, &v.cost, v.startDate, v.endDate);
        struct Vendor* heapVendor = malloc(sizeof(struct Vendor));
        *heapVendor = v;
        root = insertBST(root, v);
        insertHeap(heapVendor);
    }
    fclose(file);
}

// Save BST to file in order
void writeInOrder(struct BSTNode* node, FILE* file) {
    if (!node) return;
    writeInOrder(node->left, file);
    fprintf(file, "%d,%s,%s,%s,%s,%.2f,%s,%s\n", node->vendor.id, node->vendor.name, node->vendor.phone,
            node->vendor.email, node->vendor.workDescription, node->vendor.cost, node->vendor.startDate, node->vendor.endDate);
    writeInOrder(node->right, file);
}

void saveToFile() {
    FILE* file = fopen(FILE_NAME, "w");
    if (file) {
        writeInOrder(root, file);
        fclose(file);
    }
}

// Main
int main(int argc, char* argv[]) {
    loadFromFile();

    if (argc == 2 && strcmp(argv[1], "list") == 0) {
        listVendors();
    } else if (argc == 2 && strcmp(argv[1], "min") == 0) {
        showMinCostVendor();
    } else if (argc == 3 && strcmp(argv[1], "delete") == 0) {
        int id = atoi(argv[2]);
        if (searchBST(root, id)) {
            root = deleteBST(root, id);
            removeFromHeap(id);
            saveToFile();
            FILE* out = fopen(OUTPUT_FILE, "w");
            if (out) {
                fprintf(out, "Deleted\n");
                fclose(out);
            }
        }
    } else if (argc == 10 && strcmp(argv[1], "add") == 0) {
        struct Vendor v;
        v.id = atoi(argv[2]);
        strcpy(v.name, argv[3]);
        strcpy(v.phone, argv[4]);
        strcpy(v.email, argv[5]);
        strcpy(v.workDescription, argv[6]);
        v.cost = atof(argv[7]);
        strcpy(v.startDate, argv[8]);
        strcpy(v.endDate, argv[9]);
        struct Vendor* heapVendor = malloc(sizeof(struct Vendor));
        *heapVendor = v;
        root = insertBST(root, v);
        insertHeap(heapVendor);
        saveToFile();
        FILE* out = fopen(OUTPUT_FILE, "w");
        if (out) {
            fprintf(out, "Added\n");
            fclose(out);
        }
    }

    return 0;
}
